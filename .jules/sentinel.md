## 2024-05-23 - Prompt Injection Vulnerability in Worker
**Vulnerability:** User input was directly concatenated with system prompts without sanitization or encapsulation, allowing potential prompt injection attacks where malicious input could override system instructions.
**Learning:** Concatenating raw user input into LLM prompts is as dangerous as concatenating SQL params. The memory had instructions about wrapping in `<user_input>` but the code didn't implement it.
**Prevention:** Always encapsulate user input in XML-like tags (e.g., `<user_input>`) and sanitize the input to escape the closing tag. Enforce this via helper functions like `formatUserPrompt` and explicit system prompt constraints (`SECURITY_CONSTRAINT`).
