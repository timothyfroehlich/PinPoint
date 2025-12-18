## 2025-02-17 - Missing Input Length Limits
**Vulnerability:** User input fields (description, comments) lacked maximum length validation in Zod schemas, allowing potential DoS attacks via massive payloads.
**Learning:** Zod `string()` defaults to unlimited length. Explicit `.max()` is required for all string inputs, especially those stored in DB or processed.
**Prevention:** Enforce `.max()` on all Zod string schemas. Add tests verifying rejection of over-sized inputs.
