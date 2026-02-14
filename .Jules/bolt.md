## 2025-02-23 - Worker Message Throttling
**Learning:** Sending `postMessage` from a Web Worker for every single token update (especially with fast local LLMs) floods the main thread and causes excessive React re-renders, making the UI sluggish.
**Action:** Always implement a throttling mechanism (e.g., 50ms interval) for high-frequency updates from workers to the UI thread.
