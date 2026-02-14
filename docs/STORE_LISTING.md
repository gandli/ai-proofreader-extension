# Chrome Web Store Listing Details

## 1. Single Purpose Description

**AI Proofduck** is an intelligent writing assistant focused on improving the quality of web-based writing. All functions (**Summarize**, **Correct**, **Proofread**, **Translate**, and **Expand**) are tightly aligned with the core goal of "text optimization and processing."

## 2. Permission Justifications

- **`sidePanel`**: Provides an immersive interaction interface for writing assistance without leaving the current page.
- **`storage`**: Locally stores user preferences, engine selections, and encrypted API keys.
- **`tts`**: Provides text-to-speech for accessibility and multi-modal proofreading.
- **`activeTab`**: Adheres to the principle of least privilege, requesting temporary access to the current tab only when the user explicitly triggers the extension.
- **`contextMenus`**: Adds a shortcut to the right-click menu, serving as a legitimate user-triggered interaction to grant `activeTab` access.
- **`scripting`**: Used to safely read and process the selected text from the current page upon user activation.

## 3. Remote Code Declaration

This extension **DOES NOT** use any "Remote Hosted Code". All execution logic (JS/Wasm) is fully bundled within the extension package, complying with Content Security Policy (CSP) requirements.
