# Chrome Built-in AI 集成说明

## 概述

AI校对鸭现已支持 Chrome Built-in AI 作为第一优先引擎。Chrome AI 利用浏览器内置的 AI 模型，无需下载额外模型或配置 API Key，即可在本地完成文本处理。

## 模式与 API 对应关系

| 模式 | Chrome AI API | 最低版本 | 状态 |
|------|--------------|---------|------|
| 摘要 | Summarizer | Chrome 138+ | ✅ Stable |
| 校对 | Proofreader | Chrome 141+ | 🧪 Origin Trial |
| 润色 | Rewriter | Chrome 137+ | 🧪 Origin Trial |
| 翻译 | Translator + LanguageDetector | Chrome 138+ | ✅ Stable |
| 扩写 | Writer | Chrome 137+ | 🧪 Origin Trial |

## 引擎优先级

```
Chrome Built-in AI > WebGPU/WASM (WebLLM) > Online API
```

- 默认引擎已改为 `chrome-ai`
- 如某个模式的 Chrome AI 不可用，自动回退到在线 API（需配置 API Key）
- 用户可在设置中手动切换引擎

## 新增文件

- `types/chrome-ai.d.ts` — 所有 Chrome AI API 的 TypeScript 类型声明
- `entrypoints/sidepanel/engines/chrome-ai.ts` — Chrome AI 引擎适配器
- `entrypoints/sidepanel/engines/engine-manager.ts` — 引擎检测与推荐管理器

## 修改文件

- `entrypoints/sidepanel/worker.ts` — 新增 Chrome AI 处理路径
- `entrypoints/sidepanel/types/index.ts` — 默认引擎改为 `chrome-ai`
- `entrypoints/sidepanel/hooks/useSettings.ts` — 支持 chrome-ai 引擎状态
- `entrypoints/sidepanel/components/SettingsPanel.tsx` — 新增 Chrome AI 选项和状态显示
- `entrypoints/sidepanel/i18n.ts` — 7种语言新增 Chrome AI 相关翻译
- `wxt.config.ts` — 添加 Origin Trial token 占位符

## Origin Trial 配置

Writer、Rewriter、Proofreader API 目前处于 Origin Trial 阶段，需要在 `wxt.config.ts` 中配置 trial tokens：

```ts
trial_tokens: [
  'YOUR_WRITER_REWRITER_ORIGIN_TRIAL_TOKEN',
  'YOUR_PROOFREADER_ORIGIN_TRIAL_TOKEN',
],
```

申请地址：https://developer.chrome.com/origintrials/

## 技术细节

### Feature Detection
所有 API 使用 feature detection 检测：
```ts
if ('Summarizer' in self) { ... }
```

### 流式输出
Summarizer、Rewriter、Writer 支持流式输出（`summarizeStreaming()`、`rewriteStreaming()`、`writeStreaming()`），结果会实时更新到 UI。

### Proofreader 输出格式化
Proofreader API 返回 corrections 数组而非纯文本，适配器会：
1. 应用所有修正生成修正后文本
2. 附加修正详情列表

### Translator 语言检测
翻译模式会先用 LanguageDetector 检测源语言，再创建对应的 Translator 实例。如果源语言与目标语言相同，自动切换到合理的目标语言。
