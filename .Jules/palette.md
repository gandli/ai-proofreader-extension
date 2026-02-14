## 2025-05-15 - [Icon Button Accessibility]
**Learning:** Icon-only buttons (Settings, Clear, Fetch) are invisible to screen readers without labels.
**Action:** Always add `aria-label` to icon buttons and `role="tab"` + `aria-selected` to custom mode selectors.
