# Plan: `/oauth/consent` page for the Supabase OAuth server (PP-u4ab.5)

**Date**: 2026-07-21
**Bead**: PP-u4ab.5 (parent epic PP-u4ab; follow-up PP-u4ab.6 = technician+ access)
**Status**: Planned, not started. Admin-only per Tim.

## Why this exists

The MCP remote-admin feature (PR #1707) and the `.well-known` discovery fix
(PR #1713) are **merged and deployed to prod**. The OAuth handshake now works
end-to-end **up to the consent step**, then 404s at:

```
https://pinpoint.austinpinballcollective.org/oauth/consent?authorization_id=…
```

Root cause: **Supabase's OAuth 2.1 server does not host the consent screen — the
application must.** Supabase's authorize endpoint redirects the user to
`Site URL + Authorization Path`, and the project's Authorization Path is set to
`/oauth/consent` (already configured in the dashboard). We never built that
route. The original spec wrongly assumed Supabase provided the consent UI.

This is the **last piece** to make the handshake complete.

## Verified facts

_All of the below were re-verified against the installed code on 2026-07-21 (not
just carried over from prior notes)._

- **SDK** (`node_modules/.pnpm/@supabase+auth-js@2.110.0/.../lib/types.d.ts`,
  interface `AuthOAuthServerApi`, exposed as `supabase.auth.oauth`):
  - `getAuthorizationDetails(authorizationId: string)` → `Promise<RequestResult<OAuthAuthorizationDetails | OAuthRedirect>>`
    - `OAuthAuthorizationDetails` = `{ authorization_id: string, redirect_uri: string, client: { id, name, uri, logo_uri }, user: { id, email }, scope: string /* space-separated */ }`
      — note `client` carries `name`, `uri`, **and `logo_uri`** (we can render a client logo), plus `redirect_uri` is the base callback (no query).
    - `OAuthRedirect` = `{ redirect_url }` — returned when the user **already consented** (auto-approve); redirect immediately.
    - Narrow with `'authorization_id' in data` (per the SDK's own docstring example).
  - `approveAuthorization(id, { skipBrowserRedirect?: boolean })` → `Promise<RequestResult<OAuthRedirect>>` (`AuthOAuthConsentResponse`)
  - `denyAuthorization(id, { skipBrowserRedirect?: boolean })` → same shape; `redirect_url` carries the `access_denied` OAuth error.
  - Pass `skipBrowserRedirect: true` server-side (default `false` tries a browser redirect) and hand `data.redirect_url` to Next's `redirect()`.
  - (Also present but unused here: `listGrants()`, `revokeGrant()`.)
- **Admin gate**: `getUserAccessLevel(userId): Promise<AccessLevel>` at
  `~/lib/permissions/access.ts` (`"server-only"`). Gate on `!== "admin"`.
- **Config**: Authorization Path = `/oauth/consent` (prod). OAuth Server + DCR enabled.
- **Query param**: Supabase passes `authorization_id`.

## Implementation

### 1. `src/app/oauth/consent/page.tsx` (Server Component)

1. Read `authorization_id` from `searchParams` (Next 15 — `searchParams` is a `Promise`).
   Missing/empty → render a friendly error (no id to act on).
2. `const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();`
   (CORE-SSR-001/002 — getUser immediately, no logic between.)
   - No user → `redirect('/login?next=' + encodeURIComponent('/oauth/consent?authorization_id=' + id))`.
3. **Admin gate**: `getUserAccessLevel(user.id) !== 'admin'` → render an "access denied /
   admin-only" screen (do NOT approve). (PP-u4ab.6 tracks opening to technician+.)
4. `const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);`
   - `error` → render error state.
   - `'authorization_id' in data` → render the consent form (below).
   - else → `redirect(data.redirect_url)` (already consented — hand back to Claude Code).
5. **Consent form** (progressive enhancement, CORE-ARCH-002): a real
   `<form action={approveConsentAction}>` and a deny form/button. Show
   `data.client.name`, the requested `data.scope` (rendered as a readable list),
   and the `redirect_uri` so the user can see who/what they're authorizing.
   Hidden `<input name="authorization_id" value={id}>`.

### 2. `src/app/oauth/consent/actions.ts` (server actions)

- `approveConsentAction(formData)`:
  1. Read + validate `authorization_id` (Zod).
  2. `createClient()` → `getUser()`; re-check admin (defense in depth — never trust the page).
  3. `const { data, error } = await supabase.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true });`
  4. `error` → return/render error; else `redirect(data.redirect_url)` (external URL; Next `redirect()` handles it).
- `denyConsentAction(formData)`: same shape, `denyAuthorization(...)` → `redirect(data.redirect_url)`.

### 3. Middleware — `next` query-string gotcha (must fix or the login round-trip breaks)

`src/lib/supabase/middleware.ts` (**line 143**) redirects unauthenticated users with
`url.searchParams.set("next", path)` where `path = request.nextUrl.pathname` — the
**query string is dropped**. For `/oauth/consent?authorization_id=…`, a not-yet-logged-in
user would return from login to `/oauth/consent` **without** `authorization_id`, breaking
consent.

**Round-trip traced & verified (2026-07-21) — the ONLY fix needed is at line 143.**
The rest of the chain already preserves a query string correctly:

1. Middleware → `/login?next=<value>`. `URLSearchParams.set` **auto-encodes** the value,
   so a `next` containing its own `?authorization_id=…` is safely percent-encoded (it does
   NOT leak into the login URL as a sibling param).
2. `login/page.tsx` reads `next` from `searchParams` (Next decodes it) → passes to
   `LoginForm` → renders `<input type="hidden" name="next" value={next}>`.
3. `loginAction` (`src/app/(auth)/actions.ts:224`) does
   `getSafeRedirect(formData.get("next"))` → `redirect(next)`.
4. `getSafeRedirect`/`isInternalUrl` (`src/lib/url.ts`) accept `/oauth/consent?authorization_id=…`
   (starts with `/`, not `//`, not `/login`) and **return the value verbatim, query
   string intact**.

So the fix is a one-liner: at line 143 use `path + request.nextUrl.search` instead of
`path`. **Anti-pattern to avoid:** do NOT hand-build the login URL by string-concatenating
`?next=${path}${search}` — that would double-encode/mis-encode. Keep using
`url.searchParams.set(...)` so encoding stays correct.

`/oauth/consent` stays **auth-gated** (not in the public allowlist) — login-first is the
desired behavior. A middleware unit test should assert the redirect's `next` param
preserves the query for a `/oauth/consent?authorization_id=x` request.

## Testing (CORE-TEST-005)

- **RTL unit**: consent form renders client name + scopes; approve/deny wired to the actions.
- **Integration** (PGlite not needed — SDK boundary): mock `supabase.auth.oauth.*`
  (CORE-TEST-006) and assert: non-admin → denied; missing id → error;
  already-consented (`OAuthRedirect`) → redirect; approve/deny → `redirect(redirect_url)`.
- **verifyToken** already covered; no change here.

## UI / handoff

- UI-touching → **post screenshots** (`node scripts/workflow/pr-screenshots.mjs <PR>`)
  before calling it done. Follow the design bible (login-like focused archetype).
- Consider CSP: the page renders in a browser via the OAuth redirect; standard app CSP applies.

## Acceptance criteria

- `GET /oauth/consent?authorization_id=…` while logged in as admin renders a consent
  screen with the client name + scopes; approve redirects back to Claude Code with a code;
  deny redirects with `access_denied`.
- Non-admin (or logged-out → login → return) is handled correctly, `authorization_id` preserved.
- `claude mcp add --transport http pinpoint https://pinpoint.austinpinballcollective.org/api/mcp/mcp`
  completes consent → `whoami` returns admin identity → `list_machines` works.
- `pnpm run check` + targeted tests green; screenshots posted.

## Known follow-ups (already filed)

- **PP-u4ab.4** — harden verifyToken (audience/resource binding — the important one),
  fix create_issue idempotency + `after()` path, list_machines truncation signal.
  Best done with a real token in hand (post-handshake).
- **PP-u4ab.6** — open MCP + consent to technician+.
- Second `/code-review` pass was interrupted; a couple of candidate findings
  (owner-lookup filter-after-limit; whether the metadata route should skip session
  middleware) to fold into PP-u4ab.4.
