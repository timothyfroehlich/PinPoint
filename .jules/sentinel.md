## 2025-02-19 - Missing Input Length Limits

**Vulnerability:** Several Zod schemas (`createIssueSchema`, `addCommentSchema`) lacked `.max()` constraints on string fields.
**Learning:** Developers often forget to add upper bounds to text fields, assuming database or framework limits will catch them, but this leaves the app open to DoS or memory exhaustion.
**Prevention:** Always add `.max()` to Zod string schemas, especially for user-generated content.
