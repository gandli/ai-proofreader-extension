<div align="center">
  <a href="https://gandli.github.io/ai-proofduck-extension/">
    <img src="public/icons/icon-128.png" alt="AI Proofduck Logo" width="128" height="128" style="border-radius: 24px; box-shadow: 0 12px 40px rgba(237, 80, 7, 0.15);" />
  </a>

  <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem;">AI Proofduck</h1>

  <p style="font-size: 1.2rem; color: #666;">
    <strong>Smart Writing Assistant · Privacy First · Fully Local</strong> <br/>
    Make your writing professional, polished, and precise.
  </p>

  <p>
    <a href="#-features">Features</a> •
    <a href="#-privacy">Privacy</a> •
    <a href="#-installation">Installation</a> •
    <a href="#-tech-stack">Tech Stack</a>
  </p>

  <p>
    <a href="https://astro.build"><img src="https://img.shields.io/badge/Built%20with-Astro%205.0-orange?style=flat-square&logo=astro" alt="Built with Astro"></a>
    <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Styled%20with-Tailwind-38B2AC?style=flat-square&logo=tailwind-css" alt="Styled with Tailwind CSS"></a>
    <a href="https://lucide.dev"><img src="https://img.shields.io/badge/Icons-Lucide-pink?style=flat-square&logo=lucide" alt="Lucide Icons"></a>
  </p>

  <img src="public/images/screenshots/screenshot-en-summarize.png" alt="AI Proofduck Screenshot" width="800" style="border-radius: 12px; border: 1px solid #e5e5e5; margin-top: 20px;" />
</div>

<br />

> **AI Proofduck** is an immersive AI writing assistant residing in your browser's side panel. Leveraging cutting-edge WebGPU/WASM technology, we bring large model inference capabilities directly to your browser, ensuring absolute data privacy and lightning-fast response speeds.

---

## ✨ Core Features

AI Proofduck focuses on improving the quality of your web-based writing with five core modes:

| Mode | Description |
| :--- | :--- |
| **📝 Summarize** | Instantly extract key points from long texts to grasp the main idea. |
| **✅ Correct** | Precisely identify and fix spelling, grammar, and punctuation errors. |
| **✨ Polish** | Optimize phrasing and sentence structure to enhance professionalism and flow. |
| **🌍 Translate** | Context-aware translation across major global languages with high accuracy. |
| **🚀 Expand** | Enrich details based on short keywords to add depth and logic to your expression. |

### 🚀 Hybrid Intelligence

We offer flexible inference engine choices to meet different scenario needs:

- **⚡ WebGPU**: Utilizes hardware acceleration for extremely fast local inference (Recommended).
- **🧩 WASM**: Pure CPU local inference with the best compatibility and lightweight efficiency.
- **☁️ Online API**: Supports connection to OpenAI/Gemini compatible cloud models for maximum performance.

---

## 🔒 Privacy First

**Your data belongs to you.**

- **Zero Data Collection**: We do not collect, store, or analyze any of your input content or personal information.
- **Local First**: Defaulting to local models, data processing is completed entirely on your device, without uploading to the cloud.
- **Transparent & Controllable**: API keys are encrypted and stored locally in `localStorage`, and can be deleted at any time.

For detailed policies, please visit: [Privacy Policy Page](https://gandli.github.io/ai-proofduck-extension/#privacy)

---

## 🚀 Store Listing Details

### 1. Single Purpose Description

**AI Proofduck** is an intelligent writing assistant focused on improving the quality of web-based writing. All functions (**Summarize**, **Correct**, **Proofread**, **Translate**, and **Expand**) are tightly aligned with the core goal of "text optimization and processing."

### 2. Permission Justifications

- **`sidePanel`**: Provides an immersive interaction interface for writing assistance without leaving the current page.
- **`storage`**: Locally stores user preferences, engine selections, and encrypted API keys.
- **`tts`**: Provides text-to-speech for accessibility and multi-modal proofreading.
- **`activeTab`**: Adheres to the principle of least privilege, requesting temporary access to the current tab only when the user explicitly triggers the extension.
- **`contextMenus`**: Adds a shortcut to the right-click menu, serving as a legitimate user-triggered interaction to grant `activeTab` access.
- **`scripting`**: Used to safely read and process the selected text from the current page upon user activation.

### 3. Remote Code Declaration

This extension **DOES NOT** use any "Remote Hosted Code". All execution logic (JS/Wasm) is fully bundled within the extension package, complying with Content Security Policy (CSP) requirements.

---

<div align="center">
  <p>MIT License © 2026 <a href="https://github.com/gandli">Gandli</a></p>
</div>
