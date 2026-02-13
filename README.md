<p align="center">
<h1>AI 校对官 (AI Proofreader)</h1>
  <img src="public/icon.svg" alt="AI Proofreader Logo" width="128" height="128" />
</p>

[English](#ai-proofreader) | [中文](#ai-校对官)

---

# AI 校对官

**AI 校对官** 是一款基于浏览器侧边栏的智能写作助手扩展。它利用先进的 AI 模型（支持本地 WebGPU/WASM 及在线 API），为您提供实时的文本摘要、润色、纠错、翻译和扩写服务。

## ✨ 核心功能

- **🚀 多模式写作辅助**：
  - **摘要 (Summarize)**：快速提炼长文核心观点。
  - **纠错 (Correct)**：修正语法错误与拼写问题。
  - **润色 (Proofread)**：优化语句通顺度，提升专业性。
  - **翻译 (Translate)**：精准的中英互译。
  - **扩写 (Expand)**：基于现有内容丰富细节。
- **🔒 本地隐私优先**：支持通过 WebGPU/WASM 运行本地大模型（如 Qwen2.5），数据完全不出浏览器，保护您的隐私。
- **🌐 在线模型支持**：兼容 OpenAI 格式 API，可连接强大的云端模型。
- **📑 智能内容获取**：
  - 支持划词即时处理。
  - 无选区时自动获取当前页面正文，方便全文摘要。
- **🎨 精致 UI 设计**：
  - **活力橙主题**：采用 `#FF5A11` 品牌色，界面现代简洁。
  - **极致紧凑**：极大化内容展示空间，操作直观。
  - **国际化**：支持中英双语界面。

## 🛠️ 安装与开发

本项目使用 [WXT](https://wxt.dev/) 框架 + React + TypeScript 构建。

### 环境要求

- Node.js >= 18
- pnpm / npm / yarn / bun

### 快速开始

1. **克隆项目**

   ```bash
   git clone <repository-url>
   cd ai-proofreader-extension
   ```

2. **安装依赖**

   ```bash
   npm install
   # 或
   bun install
   ```

3. **启动开发服务器**
   此命令将在 Chrome 中加载扩展，并支持热重载（HMR）。

   ```bash
   npm run dev
   # 或
   bun dev
   ```

4. **构建生产版本**

   ```bash
   npm run build
   ```

   构建产物将位于 `.output/` 目录。

## ⚙️ 配置说明

点击侧边栏右上角的设置图标，或在模式选择栏右侧点击设置按钮即可进入配置页。

- **引擎选择**：
  - **Local (WebGPU)**：使用浏览器显卡加速，速度快，需下载模型缓存。
  - **Local (WASM)**：纯 CPU 推理，兼容性好但速度较慢。
  - **Online API**：使用 OpenAI 兼容接口（需填写 API Key 和 Base URL）。
- **语言设置**：设置扩展界面的显示语言。
- **模型参数**：当使用在线 API 时，可配置 `model` 名称。

---

# AI Proofreader

**AI Proofreader** is an intelligent writing assistant extension for your browser sidepanel. Powered by advanced AI models (supporting both local WebGPU/WASM and online APIs), it provides real-time summarization, pivoting, proofreading, translation, and expansion of text.

## ✨ Features

- **🚀 Multi-Mode Writing Assistance**:
  - **Summarize**: Quickly extract key points from long texts.
  - **Correct**: Fix grammar and spelling errors.
  - **Proofread**: Polish sentences for better flow and professionalism.
  - **Translate**: Accurate translation between languages.
  - **Expand**: Enrich details based on existing content.
- **🔒 Privacy First (Local Models)**: Run LLMs locally via WebGPU/WASM (e.g., Qwen2.5). Your data never leaves your browser.
- **🌐 Online Model Support**: Compatible with OpenAI-format APIs for connecting to powerful cloud models.
- **📑 Smart Content Fetching**:
  - Process selected text instantly.
  - Automatically fetch page body content when no text is selected for full-page summarization.
- **🎨 Premium UI Design**:
  - **Vibrant Orange Theme**: Modern interface using brand color `#FF5A11`.
  - **Compact Layout**: Maximized vertical space for content.
  - **i18n Support**: Full English and Chinese localization.

## 🛠️ Installation & Development

Built with [WXT](https://wxt.dev/), React, and TypeScript.

### Prerequisites

- Node.js >= 18
- pnpm / npm / yarn / bun

### Quick Start

1. **Clone the repo**

   ```bash
   git clone <repository-url>
   cd ai-proofreader-extension
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   bun install
   ```

3. **Start Development Server**
   Loads the extension in Chrome with HMR enabled.

   ```bash
   npm run dev
   # or
   bun dev
   ```

4. **Build for Production**

   ```bash
   npm run build
   ```

   Outputs are generated in the `.output/` directory.

## ⚙️ Configuration

Access settings via the gear icon in the sidepanel header or next to the mode selector.

- **Engine Selection**:
  - **Local (WebGPU)**: GPU-accelerated local inference (requires model download).
  - **Local (WASM)**: CPU-based local inference (slower but broader compatibility).
  - **Online API**: Use standard OpenAI-compatible APIs (requires API Key & Base URL).
- **Language**: Toggle extension interface language.
- **Model Parameters**: Configure `model` name when using Online API.

## 📄 License

MIT
