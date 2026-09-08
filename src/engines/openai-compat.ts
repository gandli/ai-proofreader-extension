/**
 * openai-compat 引擎：兼容 OpenAI /v1/chat/completions 协议的通用云端引擎
 *
 * 生态覆盖：
 * - OpenAI（gpt-4o-mini 等）
 * - DeepSeek（deepseek-chat / deepseek-reasoner）
 * - 阿里通义（qwen-turbo / qwen-plus）
 * - 火山方舟豆包
 * - 智谱（glm-4）
 * - 用户自建 Ollama / vLLM / Xinference / LM Studio（本地也走这个）
 *
 * 定位：
 * - 用户 BYOK 云端 / 自建服务的统一入口
 * - 支持全 5 种模式
 * - 优先级 70：低于本地引擎（chrome-ai/webllm）但高于免费兜底
 *
 * 隐私边界：
 * - baseUrl / model 存 sync，可以跨设备
 * - apiKey 只存 local（openai-compat-config.ts 里硬约束）
 * - 不在日志里打印 key
 * - 网关 4xx body 可能 echo Authorization 头，拼错误信息前必须脱敏（Gemini review）
 */
import type { Engine, EngineMode, EngineRunInput } from './types';
import { openaiCompatConfig } from '@core/openai-compat-config';
import { hasHostPermission } from '@core/host-permissions';
import { extractOriginPattern } from '@core/origin-pattern';
import { PermissionRequiredError } from '@utils/permission-error';
import { createFetchAbortHandle } from '@utils/fetch-abort';
import { sanitizeSecrets } from '@utils/error';

/**
 * 脱敏错误响应体，避免网关 echo 的 API key / Bearer token 泄露到日志或 UI。
 *
 * v0.5.3 P1-2：正则 pattern 提升到 @utils/error 复用（sanitizeSecrets）
 * v0.5.6 P1-A（审计 v5）：引擎侧对齐 v4 UI 侧字面量兜底 —— sanitizeSecrets 只覆盖
 *   已知格式（sk- prefix / Bearer / x-api-key），OpenAI 兼容支持自定义 apiKey 格式
 *   （DeepSeek dsk- / 通义千问 qwen- / 豆包等）→ 服务端裸回显时正则漏检。
 *   修复：正则脱敏后用 apiKey 值做字面量 split/join 兜底，双保险。
 *   门槛：`trimmed.length >= 8` 防 test-key 之类短值误替换正常错误文案。
 * v0.5.6 P1-B（审计 v5）：先切 1000 char 缓冲区再全局正则跑，避免大 body
 *   （几百 KB Cloudflare 错误页）阻塞主线程；1000 » 200 保证任何 200 char
 *   内可能展示的密钥完整跨越脱敏边界。与 v4 OpenAiCompatSection 逻辑对齐。
 */
function sanitizeErrorBody(body: string, apiKey?: string): string {
  // step 1: 缓冲区限流（安全 + 性能双赢）
  const buffered = body.slice(0, 1000);
  // step 2: 正则脱敏
  const patternSanitized = sanitizeSecrets(buffered);
  // step 3: 字面量 apiKey 兜底（自定义格式）
  if (typeof apiKey === 'string') {
    const trimmed = apiKey.trim();
    if (trimmed.length >= 8) {
      return patternSanitized.split(trimmed).join('***REDACTED***');
    }
  }
  return patternSanitized;
}

/** SSE 单个事件之间的 buffer 最大长度（防恶意/异常上游无边界推送 → OOM） */
const MAX_SSE_BUFFER = 1_048_576; // 1 MiB

function systemPromptFor(input: EngineRunInput): string {
  switch (input.mode) {
    case 'translate': {
      const src = input.sourceLang ?? 'auto';
      const tgt = input.targetLang ?? 'zh';
      return `You are a professional translator. Translate the user's text from ${src} to ${tgt}. Output ONLY the translation, no explanation, no quotes, no source text.`;
    }
    case 'summarize':
      return '你是一名擅长中文写作的编辑。请对用户提供的文本做简洁准确的摘要，只输出摘要正文，不要加任何前缀标签。';
    case 'correct':
      return '你是一名中文校对专家。请找出用户文本里的错别字、语病、标点错误，并输出改正后的版本。只输出改正后的正文。';
    case 'polish':
      return '你是一名文字润色专家。请让用户的文本更地道、更流畅、更有表现力，保留原意。只输出润色后的正文。';
    case 'expand':
      return '你是一名内容扩写助手。请将用户的短文本自然扩展成更丰富的段落，保留原意。只输出扩写后的正文。';
  }
}

function buildMessages(input: EngineRunInput) {
  return [
    { role: 'system' as const, content: systemPromptFor(input) },
    { role: 'user' as const, content: input.text },
  ];
}

/**
 * 拼 URL：处理 trailing slash + 兼容用户已填 `/v1` 后缀。
 *
 * 场景：用户在 Options 页可能填以下任意一种：
 *   - https://api.openai.com          → + /v1/chat/completions
 *   - https://api.openai.com/         → + /v1/chat/completions
 *   - https://api.openai.com/v1       → + /chat/completions（去掉重复的 /v1）
 *   - https://api.openai.com/v1/      → + /chat/completions
 *
 * 而不是拼成 https://api.openai.com/v1/v1/chat/completions（Gemini review 提出的 404 陷阱）。
 */
function joinUrl(baseUrl: string, path: string): string {
  const clean = baseUrl.replace(/\/+$/, '');
  if (clean.endsWith('/v1') && path.startsWith('/v1/')) {
    return clean + path.slice(3); // 去掉 path 里重复的 '/v1'
  }
  return clean + path;
}

export function createOpenAiCompatEngine(): Engine {
  // ⚡ Bolt: Cache config and watch for changes to avoid redundant storage reads on every isAvailable check
  let configPromise: Promise<Awaited<ReturnType<typeof openaiCompatConfig.get>>> | null = null;
  let currentModelSync: string | undefined = undefined;

  const getConfig = (): Promise<Awaited<ReturnType<typeof openaiCompatConfig.get>>> => {
    if (!configPromise) {
      configPromise = openaiCompatConfig.get().then(cfg => {
        currentModelSync = cfg.model;
        return cfg;
      });
    }
    return configPromise;
  };

  openaiCompatConfig.watch((c) => {
    currentModelSync = c.model;
    configPromise = Promise.resolve(c);
  });

  async function requireConfig() {
    const cfg = await getConfig();
    if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) {
      throw new Error('openai-compat 未配置：请在设置页填写 baseUrl / apiKey / model');
    }
    // Round 4 (#465): 权限守卫 —— 未授 host 则抛结构化错误，UI 展示【授权 CTA】
    const pattern = extractOriginPattern(cfg.baseUrl);
    const origin = new URL(cfg.baseUrl).origin;
    if (!(await hasHostPermission(pattern))) {
      throw new PermissionRequiredError({ origin, pattern });
    }
    return cfg;
  }

  const engine = {
    id: 'openai-compat' as const,
    name: 'OpenAI 兼容 · 云端 / 自建（BYOK）',
    priority: 70,
    // v0.5.3 P1-3: model 通过 getter 动态反映当前 config
    get model(): string | undefined {
      return currentModelSync;
    },

    async isAvailable(): Promise<boolean> {
      const { baseUrl, apiKey, model } = await getConfig();
      if (!baseUrl || !apiKey || !model) return false;
      // Round 3 (#465): 三项齐才检查 host 权限 —— 避免用户没配就弹权限
      let pattern: string;
      try {
        pattern = extractOriginPattern(baseUrl);
      } catch {
        return false;
      }
      return hasHostPermission(pattern);
    },

    supports(_mode: EngineMode): boolean {
      return true;
    },

    async run(input: EngineRunInput): Promise<string> {
      const cfg = await requireConfig();
      const abortH = createFetchAbortHandle(input.signal);
      try {
        const resp = await fetch(joinUrl(cfg.baseUrl, '/v1/chat/completions'), {
          method: 'POST',
          signal: abortH.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            model: cfg.model,
            messages: buildMessages(input),
            temperature: 0.3,
          }),
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          // v0.5.6 P1-A（审计 v5）：sanitizeErrorBody 已内置 apiKey 字面量兜底 + 1000 char 缓冲
          throw new Error(
            `openai-compat HTTP ${resp.status}: ${sanitizeErrorBody(text, cfg.apiKey).slice(0, 200)}`,
          );
        }
        const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== 'string') {
          throw new Error('openai-compat 响应结构异常：未取到 choices[0].message.content');
        }
        return content;
      } finally {
        abortH.cleanup();
      }
    },

    async *runStreaming(input: EngineRunInput): AsyncIterable<string> {
      const cfg = await requireConfig();
      const abortH = createFetchAbortHandle(input.signal);
      try {
        const resp = await fetch(joinUrl(cfg.baseUrl, '/v1/chat/completions'), {
          method: 'POST',
          signal: abortH.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            model: cfg.model,
            messages: buildMessages(input),
            temperature: 0.3,
            stream: true,
          }),
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          // v0.5.6 P1-A（审计 v5）：sanitizeErrorBody 已内置 apiKey 字面量兜底 + 1000 char 缓冲
          throw new Error(
            `openai-compat HTTP ${resp.status}: ${sanitizeErrorBody(text, cfg.apiKey).slice(0, 200)}`,
          );
        }
        if (!resp.body) {
          throw new Error('openai-compat 响应缺少 body（SSE 不可读）');
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let firstChunkReceived = false;

        // SSE 格式：一条事件由若干 `field: value` 行组成，事件之间空行分隔。
        // 网络层会随意切分字节 → 必须 buffer + 找事件边界。
        //
        // 分隔符必须同时支持 `\n\n` 和 `\r\n\r\n`（Gemini review 提出）：
        // 主流 API 网关（Nginx / Cloudflare / 阿里云）返回 CRLF，
        // 只识别 LF 会导致流永远拿不到完整事件、翻译挂起。
        //
        // 用 try/finally 保证 reader.cancel() 释放底层连接：
        // 用户中途取消翻译或抛错时避免 socket 泄漏（Gemini review）。
        //
        // v0.5.3 修 Gemini review #501：
        //   1. 首 chunk 到达后立即 cleanup 超时 timer——长文流式不能被 30s 误杀
        //      （超时是"服务端 hang 住不响应"的兜底，一旦有数据就说明通道活着）
        //   2. buffer 超 1 MiB 抛错——防恶意/异常上游无边界推送导致 SW OOM
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!firstChunkReceived) {
              firstChunkReceived = true;
              abortH.cleanup(); // 首 chunk 后卸掉 30s 兜底，流式长文不再被误杀
            }
            buffer += decoder.decode(value, { stream: true });
            if (buffer.length > MAX_SSE_BUFFER) {
              throw new Error(
                `openai-compat SSE buffer 超过 ${MAX_SSE_BUFFER} bytes 无事件边界，可能上游异常`,
              );
            }

            while (true) {
              const lfIdx = buffer.indexOf('\n\n');
              const crlfIdx = buffer.indexOf('\r\n\r\n');
              let idx = -1;
              let boundaryLen = 0;
              if (crlfIdx !== -1 && (lfIdx === -1 || crlfIdx < lfIdx)) {
                idx = crlfIdx;
                boundaryLen = 4;
              } else if (lfIdx !== -1) {
                idx = lfIdx;
                boundaryLen = 2;
              }
              if (idx === -1) break;

              const rawEvent = buffer.slice(0, idx);
              buffer = buffer.slice(idx + boundaryLen);

              // 用 /\r?\n/ 分行自动兼容并去除 \r（否则 `[DONE]\r` 匹不上）
              const dataLines = rawEvent
                .split(/\r?\n/)
                .filter((l) => l.startsWith('data:'))
                .map((l) => l.slice(5).trimStart());
              if (dataLines.length === 0) continue;

              const payload = dataLines.join('\n');
              if (payload === '[DONE]') return;

              try {
                const parsed = JSON.parse(payload) as {
                  choices?: Array<{ delta?: { content?: string } }>;
                };
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) yield delta;
              } catch {
                // 解析失败就跳过这个事件，不让脏数据崩掉整个流
              }
            }
          }
        } finally {
          // 无论正常结束、异常抛出还是调用方 break，都释放底层连接
          await reader.cancel().catch(() => {});
        }
      } finally {
        // v0.5.3 P0-1: 清 fetch 超时 timer（不管 SSE 是否读完）
        abortH.cleanup();
      }
    },
  };

  return engine;
}
