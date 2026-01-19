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

## 2026-01-20 - Host Header Injection in Email Invites

**Vulnerability:** Admin invitation emails were constructing links using `headers().get("host")`. This allows attackers to spoof the Host header and generate password reset or invite links pointing to malicious domains.
**Learning:** Never trust the `Host` header for constructing absolute URLs, especially for security-critical flows like authentication or invitations.
**Prevention:** Use a configured, static site URL (via `NEXT_PUBLIC_SITE_URL`) enforced by utilities like `requireSiteUrl()` to generate absolute links.

## 2026-01-12 - Hardcoded Secrets in Client Bundle

**Vulnerability:** Found `TestAdminButton` containing hardcoded test credentials was statically imported into the login form, including the credentials in the production JavaScript bundle.
**Learning:** Static imports of development-only components include their code (and secrets) in production bundles unless tree-shaken, which is unreliable for side-effect imports or complex components.
**Prevention:** Use `next/dynamic` to lazily load development-only components, ensuring their code is split into a separate chunk that is never requested in production unless the component is rendered.
