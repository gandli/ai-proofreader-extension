<div align="center">
  <h1>AI proofduck</h1>
  <img src="public/icon.svg" alt="AI proofduck Logo" width="128" height="128" />
</div>

[中文](./README.zh-CN.md) | [Changelog](./CHANGELOG.md)

---

**AI proofduck** is an intelligent writing assistant extension for your browser sidepanel. Powered by advanced AI models (supporting both local WebGPU/WASM and online APIs), it provides real-time summarization, pivoting, proofreading, translation, and expansion of text.

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

## 📦 Installation

### [Install from Chrome Web Store](https://chromewebstore.google.com/detail/gpjneodcglcajciglofbfhafgncgfmcn/)

---

## 🛠️ Development

Built with [WXT](https://wxt.dev/), React, and TypeScript.

### Prerequisites

- Node.js >= 18
- pnpm / npm / yarn / bun

### Quick Start

1. **Clone the repo**

   ```bash
   git clone https://github.com/gandli/ai-proofduck-extension
   cd ai-proofduck-extension
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

## 🚀 Store Listing Details

### 1. Single Purpose Description

AI proofduck is an intelligent writing assistant focused on **improving the quality of web-based writing**. All functions (Summarize, Correct, Proofread, Translate, and Expand) are tightly aligned with the core goal of **"text optimization and processing."**

### 2. Permission Justifications

- **sidePanel**: Provides an immersive interaction interface for writing assistance without leaving the current page.
- **storage**: Locally stores user preferences, engine selections, and encrypted API keys.
- **tts**: Provides text-to-speech for accessibility and multi-modal proofreading.
- **activeTab**: Adheres to the principle of least privilege, requesting temporary access to the current tab only when the user explicitly triggers the extension.
- **contextMenus**: Adds a shortcut to the right-click menu, serving as a legitimate user-triggered interaction to grant `activeTab` access.
- **scripting**: Used to safely read and process the selected text from the current page upon user activation.

### 3. Remote Code Declaration

**This extension DOES NOT use any "Remote Hosted Code"**. All execution logic (JS/Wasm) is fully bundled within the extension package, complying with Content Security Policy (CSP) requirements.

---

## 📄 License

MIT
