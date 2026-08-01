# Handoff: pivot MCP auth from Supabase OAuth → static bearer token (Claude Code)

**Date**: 2026-07-22
**Branch**: `feat/mcp-bearer-token` (this doc is the first commit; do the implementation here)
**Epic**: PP-u4ab (MCP remote admin). This handoff covers the **auth pivot** decided 2026-07-22.
**Why this doc exists**: the originating "bridge" session isn't resumable on the Bazzite box, so this is a full self-contained handoff. You should need **zero re-investigation** — everything diagnosed is below.

---

## TL;DR / the decision

Tim confirmed: **drop Supabase's OAuth 2.1 server as the MCP auth provider; use a static bearer token, with Claude Code as the client.** This is the right call for a **private, single-user (admin-only) MCP server** — full OAuth/DCR/consent is the heavyweight model for untrusted third parties, and Supabase's implementation is too immature (details below). Implement the bearer-token auth per the plan in this doc.

**Do NOT** keep trying to fix the Supabase OAuth path. **Do NOT** delete the consent page — leave it dormant (Tim's call).

---

## What is already merged & live in prod (do not redo)

All merged to `main` and deployed to prod (`https://pinpoint.austinpinballcollective.org`):

- **PR #1703** (PP-u4ab.1) — service extraction.
- **PR #1707** (PP-u4ab.2) — the MCP endpoint + `verifyToken` (OAuth-JWT flavor) + 6 tools + audit.
- **PR #1713** — `.well-known` discovery made public in middleware.
- **PR #1719** (PP-u4ab.5) — the app-hosted OAuth consent page at `/oauth/consent`. **This works** (verified live), but becomes dormant after this pivot.

**The MCP surface that stays:**

- Endpoint: `src/app/api/mcp/[transport]/route.ts` → served at `…/api/mcp/mcp` (doubled `mcp`: basePath `/api/mcp` + mcp-handler serves the stream at `<basePath>/mcp`). `runtime="nodejs"`, `maxDuration=60`, `disableSse:true`.
- 6 tools: `src/lib/mcp/tools/{list-machines,get-machine,set-machine-availability,add-machine,set-machine-owner,create-issue}.ts` + `index.ts` (`registerPinpointTools`). **These do not change.**
- `src/lib/mcp/tools/shared.ts` — `runTool`, `McpToolError`, resolvers. Unchanged.
- `src/lib/mcp/audit.ts` — `logMcpToolCall`. Unchanged.
- `McpAuthContext` / `requireMcpAuthContext` in `verify-token.ts` — the shape stays the same so tools don't change.

---

## Why we pivoted (so you don't re-litigate)

Full diagnosis done via Supabase MCP logs + two web-research passes. Findings:

1. **The whole OAuth flow works up to the token exchange.** Discovery → DCR → authorize → **our consent page renders & approve succeeds → Supabase issues the auth code** (confirmed: `auth.oauth_consents` row written). Our `verifyToken` never even runs.
2. **Supabase's own `/oauth/token` endpoint returns HTTP 500** on the `authorization_code` exchange (seen in Supabase `api` gateway logs: `POST | 500 | /auth/v1/oauth/token | python-httpx` — that's Claude's backend). Claude surfaces it as `error_code=mcp_token_exchange_failed`.
3. **Root cause = Supabase bug** [supabase/auth #2339](https://github.com/supabase/auth/issues/2339): Claude requests the `openid` scope, so Supabase must sign an OIDC **ID token**; it picks **HS256**, which OIDC forbids for ID tokens, so signing throws and the handler wraps it as a 500. Prod's OAuth metadata still advertises `id_token_signing_alg_values_supported: ["RS256","HS256","ES256"]` — HS256 present despite an ES256 key existing in the JWKS.
4. **Even fixing that isn't enough.** Research verdict (high confidence): Supabase's OAuth 2.1 server is **beta since 2025-11-26, not GA**; there are **no public end-to-end success reports** for "own MCP server + Supabase OAuth + Claude." Next walls after HS256: confidential-vs-public client bugs ([#29680](https://github.com/NousResearch/hermes-agent/issues/29680), Supabase discussion [#38022](https://github.com/orgs/supabase/discussions/38022)) — Supabase registers Claude as `confidential`/`client_secret_post`, Claude behaves as a public/PKCE client, and **public-client registration is itself reported broken**. We already saw the `400: client_id is required` this produces.
5. The `resource` trailing-slash mismatch (our metadata `…org` vs stored `…org/`) is **cosmetic**, not the cause.

**Conclusion:** whack-a-mole against an open, no-timeline beta bug cluster. Bearer token sidesteps all of it.

---

## The implementation plan

### 1. Rewrite `src/lib/mcp/verify-token.ts` → bearer-token validation

Keep `createVerifyToken(deps)` + default `verifyToken` + `McpAuthContext` + `requireMcpAuthContext` **exactly as-is in shape**. Replace only the verification logic:

- New `verifyToken(request, bearerToken?)`:
  1. `if (!bearerToken) return undefined`.
  2. Read `MCP_BEARER_TOKEN` from env; if unset → `undefined` (misconfigured, fail closed).
  3. **Constant-time compare** the presented token vs the secret. Use SHA-256 of both then `crypto.timingSafeEqual` on the digests — this avoids the length-based early-return/timing leak of comparing raw buffers:
     ```ts
     import { createHash, timingSafeEqual } from "node:crypto";
     const digest = (s: string) => createHash("sha256").update(s).digest();
     if (!timingSafeEqual(digest(bearerToken), digest(expected)))
       return undefined;
     ```
  4. Read `MCP_ADMIN_USER_ID` from env; if unset → `undefined`.
  5. `const accessLevel = await getUserAccessLevel(userId)` (from `~/lib/permissions/access`). Require `accessLevel === "admin"` (defense in depth — if the mapped user's role ever changes, the token stops working). Log a warn on non-admin like the current code does.
  6. Return `AuthInfo`: `{ token: bearerToken, clientId: "claude-code-bearer", scopes: [], extra: { userId, accessLevel, clientId: "claude-code-bearer" } satisfies McpAuthContext }`.
- Drop the Supabase `getClaims`/JWKS code (`getClaimsClient`, `verifyClaimsWithSupabase`, `VerifiedClaims`, the `client_id`-claim requirement). Keep `isAccessLevel`, `ACCESS_LEVELS` usage, `requireMcpAuthContext`.
- The `VerifyTokenDeps` injection pattern can stay (inject `getUserAccessLevel` + optionally an env reader) so tests stay hermetic.

### 2. Two new env vars (CORE-SEC-009 — central registry, no secret coupling)

- `MCP_BEARER_TOKEN` — the shared secret (generate: `openssl rand -hex 32`). **Do not** prefix `NEXT_PUBLIC_`. Not reused as any other var's fallback.
- `MCP_ADMIN_USER_ID` — Tim's Supabase user UUID (the identity all MCP tool calls act as, for audit + `checkPermission`).
- Register **both** in `next.config.ts` → `assertVercelDeploymentEnv` build registry (so a missing value fails the Vercel build, per CORE-SEC-009).
- Document both in `docs/ENV_VARS.md` (scope: server-only, production-required).
- Tim sets them in **Vercel prod env** + local `.env.local`.

**Tim's admin UUID**: there are 5 admin accounts in prod; the emails were PII-blocked so this session couldn't identify Tim's. Tim must supply his own UUID (he can find it on his Settings page, or an admin can look it up). The 5 admin UUIDs (Tim picks his own): `79727d47-76a7-4e54-89a2-774256d81034`, `3fe49d22-af58-47ac-aecb-9345a882ba0c`, `0368d363-48e5-48b5-8378-7483bb48c8c8`, `7e8e2e01-79db-4728-bbcb-c4ca463e9dd7`, `4ea90625-d234-4049-8e75-14ac399bc7d5` (earliest-created is `79727d47…`, likely but NOT confirmed to be Tim — confirm with him).

### 3. Remove the now-dead OAuth discovery plumbing (keep endpoint + tools + consent page)

- Delete `src/app/.well-known/oauth-protected-resource/route.ts` (it advertises an OAuth flow we no longer use). Remove its include glob from `tsconfig.app.json` (`"src/app/.well-known/**/*"`) if nothing else needs it.
- In `src/app/api/mcp/[transport]/route.ts`: keep `createMcpHandler` + `registerPinpointTools` + the `whoami` tool. For auth, keep it simple — either keep `withMcpAuth(handler, verifyToken, { required: true })` (fine; its 401 `WWW-Authenticate` just won't point at a live resource-metadata doc, which is harmless for a bearer client) **or** replace `withMcpAuth` with a thin inline guard that runs the bearer `verifyToken` and 401s on `undefined`. Prefer whichever is cleaner; keeping `withMcpAuth` is lower-churn.
- `src/lib/mcp/config.ts`: drop `MCP_RESOURCE_METADATA_PATH` + `getAuthServerUrls` (OAuth-only). Keep `MCP_BASE_PATH`.
- Middleware (`src/lib/supabase/middleware.ts`): the `.well-known` + `/api` public-route allowances from #1713 can stay (harmless) or be trimmed to just what's needed. The `next`-query fix from #1719 **stays** (general improvement).
- **Keep the consent page** `src/app/(auth)/oauth/consent/*` as dormant code (Tim's explicit call). It's unreachable once Supabase's OAuth server is off, but do not delete.

### 4. Tests

- Rewrite `src/lib/mcp/verify-token.test.ts` for the bearer path: valid token + admin-mapped user → returns `McpAuthContext`; wrong token → `undefined`; missing token → `undefined`; missing env → `undefined`; mapped user not admin → `undefined` (+ warn). Keep them hermetic via the deps injection.
- `src/test/integration/mcp-tools.test.ts` (15 tests) should still pass unchanged (tools didn't change) — verify.
- Delete/replace any test asserting the OAuth `client_id`-claim requirement or the `.well-known` route.

### 5. Ship it

- `pnpm run check` (floor) + `pnpm run preflight` (this touches auth → non-trivial). Local `parallel`/`sem` is installed via linuxbrew, so locked preflight works; if not, `pnpm run preflight:unlocked`.
- PR ready-for-review. Not UI-touching (consent page unchanged) → no screenshots needed.
- **Merge is human-only**: hand Tim `! scripts/workflow/merge-pr.sh <PR> --human`.
- After Tim sets the env vars in Vercel + merges + deploys, he connects with:
  ```
  claude mcp add --transport http pinpoint https://pinpoint.austinpinballcollective.org/api/mcp/mcp --header "Authorization: Bearer <MCP_BEARER_TOKEN>"
  ```
  Then verify `whoami` → returns Tim's admin identity → `list_machines` works. **That's the acceptance test for the whole epic.**

### 6. Cleanup (optional, Tim's call)

- Disable Supabase's OAuth server (Dashboard → Authentication → OAuth Server) since it's now unused. Optionally comment on supabase/auth #2339 with our `ofid_` reference to push the 500→proper-4xx fix.

---

## Security posture (state it in the PR)

A static bearer token is a long-lived admin secret — appropriate for a **private single-user** server (essentially a personal access token). Stored in env, HTTPS-only, **constant-time compared** (hashed), fails closed if unset, and re-checks the mapped user is still `admin` on every call. If leaked → rotate the env var. This is a deliberate, reasonable tradeoff vs. OAuth's per-session tokens for this use case. Per-tool `checkPermission()` still runs under each tool as defense in depth.

---

## Beads

- Epic **PP-u4ab** (MCP remote admin) — open.
- **PP-u4ab.2** — the OAuth `verifyToken`; this pivot supersedes its OAuth approach with bearer. Update, don't spawn sliver-beads.
- **PP-u4ab.5** — consent page; merged (#1719), now dormant. Leave closed/as-is.
- **PP-u4ab.4** (P2), **PP-u4ab.3** (rate-limit, P3), **PP-u4ab.6** (technician+, P3) — these were OAuth-era hardening; re-scope or close now that OAuth is dropped. PP-u4ab.6 (open to technician+) is moot for a single-user bearer token.
- File a small bead if you want to track "revisit Supabase OAuth after GA" — link #2339.

---

## Key references

- Research verdict + sources: supabase/auth #2339 (HS256 500), NousResearch/hermes-agent #29680 (confidential client), Supabase discussion #38022 (OAuth-server status/limits), atlassc.net 2026-04-03 (public-client Claude connector), Vercel MCP adapter OAuth, WorkOS/Stytch Vercel MCP templates, anthropics/claude-ai-mcp #112 (claude.ai connector has no bearer/header option — this is why we chose **Claude Code**, which does).
- Original OAuth spec (now partly superseded): `docs/superpowers/specs/2026-07-18-mcp-remote-admin.md`.
- Consent-page plan (shipped): `docs/plans/2026-07-21-mcp-oauth-consent-page.md`.
