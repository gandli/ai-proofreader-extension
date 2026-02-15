# AI Proofduck 代码审查报告

**审查日期**: 2025-02-15  
**项目**: AI 校对鸭 - 浏览器写作助手扩展  
**总评分**: 6.5 / 10

---

## 一、项目概览

基于 WXT 框架的 Chrome 扩展，使用 React 19 + TypeScript + Tailwind CSS 构建侧边栏 UI，集成 WebLLM（本地推理）和 OpenAI 兼容 API（在线推理），提供摘要/校对/润色/翻译/扩写五种文本处理模式。支持 7 种语言的 UI 国际化。

---

## 二、优点

### 2.1 架构设计合理
- WXT 框架使用规范，entrypoints 划分清晰（background / content / sidepanel）
- Web Worker 隔离 LLM 推理，不阻塞 UI 线程
- Shadow DOM 隔离 content script UI，避免样式污染
- 本地推理请求队列（`localRequestQueue`）防止并发冲突

### 2.2 功能完整度高
- 浮动图标 + 悬停翻译 + 侧边栏完整流程
- 离线模型导入/导出（自定义 MLCP 二进制格式）
- API Key 存储在 session storage（安全意识好）
- 多引擎支持（WebGPU / WASM / Online API）
- 暗色模式适配

### 2.3 开发工具链
- ESLint + Prettier + TypeScript strict mode
- Vitest 单元测试 + Playwright E2E
- CI/CD 自动构建 + CRX 打包 + GitHub Release

---

## 三、问题与改进建议

### 3.1 🔴 严重问题

#### (1) App.tsx 巨型组件（~500 行）
整个应用逻辑塞在一个组件里，包含设置面板、结果展示、文件导入/导出、所有状态管理。

**建议**: 拆分为独立组件和 custom hooks：
- `useSettings()` hook
- `useWorker()` hook  
- `<SettingsPanel />`, `<ResultPanel />`, `<ModeSelector />`, `<ModelImportExport />`

#### (2) content.ts 过于庞大（~300 行）
翻译弹窗的 HTML 全部用字符串拼接，事件绑定手动管理，难以维护。

**建议**: 考虑使用 WXT 的 content script UI 功能（支持 React 渲染到 Shadow DOM），或至少将弹窗逻辑抽成独立模块。

#### (3) `any` 类型滥用
- `worker.ts` 中 `settings: any` 出现多次
- `App.tsx` 中 `runtimeListener` 的参数类型为 `any`
- `worker-utils.ts` 中 `settings: any`

**建议**: 定义并共享 `Settings` 接口，在 worker 通信中使用 discriminated union 类型。

#### (4) 单元测试与实际代码不匹配
`worker-utils.test.ts` 断言 `你是一个摘要提取工具` 和 `你是一个文字润色编辑`，但 `prompts.ts` 中实际文本是 `你是一个专业的首席速读官` 和 `你是一个大厂资深文案编辑`。测试会失败。

### 3.2 🟡 中等问题

#### (5) i18n 实现不够理想
- 两套 i18n 系统并存：Chrome `_locales` 仅用于 manifest，应用内用自建 `translations` 对象
- `translations` 没有 TypeScript 类型安全，用 `Record<string, any>` 定义
- 新增翻译键时无编译时检查

**建议**: 为翻译定义严格的 TypeScript 接口，或使用 `i18next` 等成熟方案。

#### (6) 内联 Tailwind 类名过长
按钮的 className 动辄 200+ 字符，可读性极差。例如：
```tsx
className={`flex-1 py-2 px-0.5 border-none bg-transparent rounded-md text-[11px] font-semibold text-slate-600 cursor-pointer transition-all hover:bg-brand-orange/10 hover:text-brand-orange dark:text-slate-400 dark:hover:bg-brand-orange/15 dark:hover:text-[#ff7a3d] ${mode === 'summarize' ? 'bg-white text-brand-orange shadow-sm dark:bg-[#2a2a3e] dark:text-[#ff7a3d]' : ''}`}
```

**建议**: 使用 `@apply` 定义复用样式，或用 `clsx`/`cva` 管理条件类名。

#### (7) 模式标签重复代码
5 个模式按钮几乎相同的 JSX，只有 `mode` 值和文本不同。底部按钮的三元嵌套也很深。

**建议**: 用数组 `.map()` 渲染。

#### (8) QUICK_TRANSLATE 消息处理存在竞态
`handleTranslateResponse` 监听所有 worker 消息中 `mode === 'translate'` 的完成，如果同时有侧边栏的翻译任务，会互相干扰。

**建议**: 使用请求 ID 关联请求和响应。

#### (9) content script 匹配 `<all_urls>`
在所有页面注入 content script，性能开销大。

**建议**: 考虑使用 `activeTab` 权限 + 按需注入，或至少排除浏览器内部页面。

#### (10) prompts 全部硬编码中文
即使用户语言设为 English，系统提示词也是中文（`你是一个专业的首席速读官`），这可能影响非中文模型的表现。

**建议**: 根据 `extensionLanguage` 提供对应语言的 prompt 模板。

### 3.3 🟢 小问题

#### (11) `hoverTimer` 类型为 `any`
应使用 `ReturnType<typeof setTimeout>` 或 `number`。

#### (12) `useEffect` 依赖数组问题
`App.tsx` 主 `useEffect` 依赖为 `[]`，但内部引用了 `settings` 状态（通过 `settingsRef` 规避）。虽然能工作，但不够直观。

#### (13) SVG 内联过大
`floatingIcon.ts` 中的 SVG 字符串极长（~760 行 SVG filter 定义），应该用简化版图标或外部 SVG 文件。

#### (14) `handleExportModel` 内存风险
将所有模型文件加载到一个 ArrayBuffer 中。对于大模型（5GB+），可能导致浏览器 OOM。

**建议**: 使用 Streams API 或分块下载。

#### (15) 缺少 `fetch_page_content` 在 i18n `translations` 中的使用
`_locales` 中定义了 `fetch_page_content` 但应用内未通过 `chrome.i18n.getMessage` 使用。

#### (16) CI 中 CRX 签名密钥每次重新生成
每次构建生成新的 `key.pem`，导致扩展 ID 不稳定。

**建议**: 将签名密钥存为 GitHub Secret。

#### (17) 缺少错误边界
React 应用没有 ErrorBoundary，worker 初始化失败等异常可能导致白屏。

#### (18) `webkitdirectory` 属性
`webkitdirectory="true"` 不是标准属性，需要在 `types.d.ts` 中声明（已有但应确认）。

---

## 四、安全审查

| 项目 | 状态 | 说明 |
|------|------|------|
| API Key 存储 | ✅ 良好 | 使用 session storage，带 fallback |
| CSP | ⚠️ 注意 | 未在 manifest 中配置 CSP |
| 权限 | ⚠️ 偏多 | `<all_urls>` + `tts` + `scripting` 等，审核可能被拒 |
| XSS | ✅ 安全 | 弹窗内容通过 `textContent` 设置 |
| 网络请求 | ✅ 可控 | 仅调用用户配置的 API 地址 |

---

## 五、性能审查

| 项目 | 状态 | 说明 |
|------|------|------|
| Worker 推理 | ✅ 好 | 不阻塞主线程 |
| Content Script | ⚠️ | 所有页面注入，增加内存占用 |
| 模型导出 | ⚠️ | 大模型可能 OOM |
| React 渲染 | ⚠️ | App 组件过大，状态变化导致不必要的重渲染 |

---

## 六、评分细项

| 维度 | 评分 (1-10) | 说明 |
|------|:-----------:|------|
| 功能完整性 | 8 | 五种模式 + 多引擎 + 离线导入，功能丰富 |
| 代码组织 | 5 | 单文件过大，组件未拆分 |
| TypeScript 使用 | 5 | strict 模式但 any 泛滥 |
| 测试覆盖 | 4 | 有测试框架但测试与代码不匹配，覆盖率低 |
| UI/UX | 7 | 精致的设计，暗色模式，响应式布局 |
| 安全性 | 7 | API Key 保护好，但权限过宽 |
| 可维护性 | 5 | 大量重复代码，缺乏抽象 |
| CI/CD | 7 | 完整流程，但 CRX 签名有问题 |
| 国际化 | 6 | 7 种语言但实现粗糙，无类型安全 |
| 文档 | 6 | README 完整，但缺少架构文档 |

**综合评分: 6.5 / 10**

---

## 七、优先改进路线

1. **立即修复**: 单元测试断言与实际 prompt 不匹配
2. **短期**: 拆分 `App.tsx` 为多个组件和 hooks；消除 `any` 类型
3. **短期**: 将模式按钮改为数组驱动渲染，减少重复代码
4. **中期**: 为 QUICK_TRANSLATE 添加请求 ID 避免竞态
5. **中期**: 优化 content script 注入策略，减少权限申请
6. **长期**: 重构 i18n 方案，prompt 多语言化
7. **长期**: 模型导出使用流式处理，支持大模型
