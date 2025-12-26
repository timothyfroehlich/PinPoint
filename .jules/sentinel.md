# Sentinel Journal

## 2025-05-22 - Insecure Markdown Rendering via dangerouslySetInnerHTML

**Vulnerability:** Found duplication of insecure markdown parsing logic in `roadmap/page.tsx` and `changelog/page.tsx`. The custom parser used `dangerouslySetInnerHTML` with manual regex replacement that did not sanitize link protocols, allowing XSS via `javascript:` links.
**Learning:** Manual HTML construction from user/file input is error-prone. Even "read-only" files like ROADMAP.md can be vectors if compromised or if the parser is reused for user content later. Duplication leads to inconsistent security patching.
**Prevention:** Centralized markdown rendering in `src/lib/markdown.ts` using `sanitize-html` to enforce allow-lists for tags and attributes. Always sanitize HTML before injecting it.
