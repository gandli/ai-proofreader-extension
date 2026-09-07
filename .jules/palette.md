## 2025-07-15 - Added Copy Button to ResultPanel
**Learning:** Adding a copy button for translation results is a significant UX improvement for quick operations in a sidepanel. While implementing this, it's critical to ensure the `navigator.clipboard` access is guarded with a `typeof navigator !== 'undefined'` check to avoid SSR or test environment crashes. It's also important to provide visual feedback (like a checkmark) and use proper ARIA labels (`aria-label`) that update based on the copy state for accessibility.
**Action:** Always include visual feedback, `aria-label`, `title`, and `focus-visible` styles for icon-only interactive buttons to ensure accessibility and usability. Always guard browser APIs like `navigator` against undefined environments.

## 2025-07-28 - Link error state to textarea
**Learning:** Using `aria-invalid` and `aria-describedby` provides immediate context to screen reader users when a text area enters an error state (like exceeding character limit). Removing `aria-live` from the counter span prevents the screen reader from double-announcing input.
**Action:** Always link visual error states and helper texts to inputs using `aria-invalid` and `aria-describedby`.

## 2025-07-27 - Fixed Focus Loss on Clear Button
**Learning:** When a button disables itself upon being clicked (like a "Clear Text" button that becomes disabled when the input is empty), the keyboard focus is lost and resets to the `body` element. This creates a highly frustrating experience for screen reader and keyboard users who must tab all the way back through the page. Additionally, adding `aria-invalid` to textareas when limits are exceeded improves form accessibility.
**Action:** Always programmatically manage focus (e.g., return focus to the primary input field) when an action disables the currently focused interactive element. Use `aria-invalid` for constraint validation states.
## 2025-05-18 - Improve Gemini API Key Visibility

**Learning:** The Gemini API configuration section in the Options page had a password field for the API Key but no way for the user to toggle visibility. Given that API Keys are long and hard to verify when pasted, providing a toggle (like the one used in `OpenAiCompatSection`) significantly improves the user experience by reducing errors.
**Action:** Implemented a visibility toggle for the API key input in `GeminiSection` to match the UX in `OpenAiCompatSection`, using the `Eye` and `EyeOff` icons from `lucide-react` with proper aria-labels and tooltips.

## 2025-08-01 - Fix dangling aria-controls
**Learning:** When using `aria-controls` on a button, it is critical to ensure the target element actually has the corresponding `id` attribute. A dangling `aria-controls` without a matching `id` breaks screen reader navigation, as the screen reader cannot programmatically link the control to the content it affects.
**Action:** Always verify that the `id` specified in `aria-controls` exists in the DOM.

## 2025-08-09 - Ensure dynamic success messages are announced
**Learning:** When conditionally rendering a success message upon form save (e.g., in `GeminiSection`), placing the condition outside an `aria-live` region means screen readers often miss the update because the region itself wasn't in the DOM at the time of the update.
**Action:** Always wrap conditionally rendered status messages inside a permanent, non-conditional container element with `role="status"` and `aria-live="polite"` to ensure they are reliably announced.
## 2025-08-10 - Add tooltip explaining disabled button state
**Learning:** Buttons that are disabled dynamically (e.g. "Test Connection" when form is incomplete) can be confusing for users if they don't know *why* it's disabled. Adding a dynamic `title` attribute that explains the disabled state significantly improves usability.
**Action:** Always provide a `title` or tooltip explaining the condition when disabling an interactive element based on form state.

## 2025-10-23 - Disable Save buttons when required fields are empty
**Learning:** In configuration forms (like Gemini or OpenAI-Compat APIs), users might click "Save" when required fields (like API Key or Base URL) are missing, resulting in saving invalid states to storage.
**Action:** Always disable the Save/Submit button when required fields are missing using `disabled` attribute and visual feedback (`disabled:opacity-50`) to prevent saving invalid configurations and improve the intuitiveness of the form.
 (🎨 Palette: Disable Save buttons when required fields are empty)

## 2025-08-20 - Add explicit required indicators to configuration forms
**Learning:** While disabling the 'Save' button is a good preventive measure for incomplete forms, users still need explicit upfront visual cues and semantic indicators (like asterisks and `aria-required`) to understand *which* fields are required before they attempt to submit.
**Action:** Always add visual indicators (`*`) and `required`/`aria-required` attributes to required form inputs to improve clarity and screen reader accessibility.

## 2026-08-31 - Add explicit helper text for sensitive inputs
**Learning:** The Gemini API configuration lacked explicit helper text explaining the storage and privacy guarantees for the sensitive API Key, unlike the `OpenAiCompatSection`. Adding this text and linking it via `aria-describedby` provides immediate context to screen reader users and reassures all users about privacy.
**Action:** Always provide explicit helper text for sensitive inputs (like API keys) explaining storage and privacy guarantees (e.g., 'Stored locally, encrypted'), and link this text to the input using the `aria-describedby` attribute for screen reader accessibility.

## 2023-11-20 - Add focus visible styles to custom inline-styled buttons
**Learning:** Icon-only buttons (like the copy and close buttons in `SuccessBubble`) often rely heavily on inline styles for placement and appearance. However, failing to apply explicit focus styles makes these buttons completely inaccessible to keyboard users, as there is no visual indicator when they receive focus.
**Action:** Always ensure interactive elements (especially icon-only or custom buttons, even if heavily inline-styled) have explicit visible focus indicators using the project's established Tailwind utility classes (e.g., `className="focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"`) via the `className` attribute.
