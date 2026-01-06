# Sentinel Journal

## 2025-12-16 - Missing Input Length Limits

**Vulnerability:** Found that authenticated users could submit unlimited length strings for issue descriptions and comments.
**Learning:** Zod schemas for authenticated actions were missing `.max()` constraints, while public forms had them.
**Prevention:** Always audit schemas for `.max()` constraints on string fields to prevent DoS.

## 2025-05-22 - Insecure Markdown Rendering via dangerouslySetInnerHTML

**Vulnerability:** Found duplication of insecure markdown parsing logic in `roadmap/page.tsx` and `changelog/page.tsx`. The custom parser used `dangerouslySetInnerHTML` with manual regex replacement that did not sanitize link protocols, allowing XSS via `javascript:` links.
**Learning:** Manual HTML construction from user/file input is error-prone. Even "read-only" files like ROADMAP.md can be vectors if compromised or if the parser is reused for user content later. Duplication leads to inconsistent security patching.
**Prevention:** Centralized markdown rendering in `src/lib/markdown.ts` using `sanitize-html` to enforce allow-lists for tags and attributes. Always sanitize HTML before injecting it.

## 2026-01-06 - Sensitive Information Exposure in Server Actions

**Vulnerability:** Server Actions were returning raw error messages from the backend/database directly to the client in the `SERVER` error code path.
**Learning:** This can expose database connection strings, schema details, or other sensitive internal information to attackers if an unhandled exception occurs.
**Prevention:** Always catch errors in Server Actions and return a generic "An unexpected error occurred" message to the client, while logging the full error details on the server for debugging.
