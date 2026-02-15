## 2025-05-23 - [Accessibility] Mode Toggle Buttons
**Learning:** Adding `aria-pressed` to mode toggle buttons (like "Summarize", "Translate") is critical for screen reader users to understand which mode is currently active, as color changes alone are insufficient.
**Action:** Always check toggle-like button groups for `aria-pressed` or implement `role="radio"` with `aria-checked` if they function as a single-choice group.
