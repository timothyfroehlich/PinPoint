# MCP Remote Admin — Spec

**Date**: 2026-07-18
**Status**: Approved by Tim; ready for implementation (planned on Bazzite)
**Goal**: Tim talks to Claude ("Godzilla left the building", "add a machine", "file an issue on X") and Claude performs the action against production PinPoint through the app's existing protected code paths. Immediate target: Claude Code. End target: the Claude app (desktop + mobile) via a custom remote MCP connector.

## Decisions already made (do not re-litigate)

1. **No direct DB access.** Every mutation goes through the same validation + `checkPermission()` machinery the web app uses.
2. **The agent acts as Tim.** MCP calls resolve to Tim's real `user_profiles` row (admin role). No service-account role, no schema enum change. Actions are attributed to Tim in timelines/notifications, indistinguishable from him using the UI. Tim explicitly accepted this.
3. **Straight to OAuth — no API-key phase.** Supabase Auth's OAuth 2.1 server feature is the authorization server; the MCP endpoint is a resource server that validates ordinary Supabase JWTs. No API-key table, no custom token issuance. Claude Code and the Claude app both speak MCP OAuth.
4. **Hosted inside the PinPoint Next.js app** on Vercel via `mcp-handler` — no new infrastructure.
5. **Two PRs**: (1) behavior-preserving service-layer extraction for machine mutations; (2) the MCP endpoint + auth + tools. Each ships complete.

## Verified platform facts (mid-2026; re-verify only if something fails)

- **Supabase OAuth 2.1 server**: enabled per-project in Dashboard → Authentication → OAuth Server. Discovery metadata at `https://<project-ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1`. Dynamic Client Registration is an optional toggle (each client still gets a user-approval consent screen). Access tokens are **standard Supabase JWTs**: `sub`/`user_id` = user UUID, `role: "authenticated"`, plus `client_id` identifying the OAuth client. OAuth scopes (`openid`, `email`, …) only shape ID-token contents — they do **not** gate API access; app authorization stays entirely ours.
  Docs: https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication and …/token-security
- **`mcp-handler` v1.1.0** (Vercel's official adapter; requires `@modelcontextprotocol/sdk` ≥ 1.26.0 — earlier versions have a security vuln):
  - `createMcpHandler(...)` in a route handler (`app/api/[transport]/route.ts` pattern), tools registered via `server.registerTool(name, {title, description, inputSchema}, handler)` with Zod `inputSchema`.
  - `withMcpAuth(handler, verifyToken, {required, resourceMetadataPath})`: `verifyToken(request, bearerToken)` returns `undefined` (→ 401) or an `AuthInfo` (`{token, scopes, clientId, extra}`); `extra` is where we put `{userId, accessLevel}`. Auth info reaches tool handlers via `extra.authInfo`.
  - `protectedResourceHandler` serves `/.well-known/oauth-protected-resource` listing Supabase as the authorization-server issuer — this is how MCP clients discover where to do OAuth.
    Docs: https://github.com/vercel/mcp-handler/blob/main/docs/AUTHORIZATION.md
- **Claude app custom connectors**: all plans, mobile included (beta). OAuth only — the connector UI has **no static-bearer-token field**. Streamable HTTP transport.
- **Claude Code**: `claude mcp add --transport http pinpoint <url>` — performs the MCP OAuth flow when the server responds 401 with resource metadata.

## Spike first (do this before building all the tools)

Wire ONE trivial protected tool (e.g. `whoami` returning the resolved user + access level) end-to-end and confirm the full handshake: Supabase OAuth server enablement → DCR from Claude Code → consent screen → token → `verifyToken` → tool call. This validates the only genuinely uncertain link (Claude's OAuth client ↔ Supabase's DCR implementation, both newish). If DCR misbehaves, fall back to pre-registering the client manually in the Supabase dashboard (supported) before touching any tool code. Everything after the spike is conventional work.

Note for local dev: whether the Supabase CLI's local stack supports the OAuth server feature is **unverified**. If it doesn't, develop the resource-server side locally with a locally-minted JWT (any signed-in local session token exercises the same `verifyToken` path) and test the OAuth handshake against a preview/prod Supabase project.

## PR 1 — Extract machine mutation services (behavior-preserving refactor)

Machine actions in `src/app/(app)/m/actions.ts` inline their transactions; issues already have the right shape in `src/services/issues.ts` (typed params objects; transaction + timeline events + notification planning inside; external effects after commit per CORE-ARCH-011). Mirror that shape for machines in `src/services/machines.ts`:

- `createMachine(params)` — extracted from `createMachineAction` (line ~306). Params mirror `CreateMachineInput` from `src/app/(app)/m/schemas.ts` plus `actorUserId`.
- `updateMachineOwner(params)` — the owner-change slice of `updateMachineAction` (line ~781), including any owner-promotion side-logic (`forcePromoteUserId`).
- `updateMachinePresence(params)` — extracted from `updateMachinePresenceAction` (line ~1517), including its timeline event.

The existing server actions become thin wrappers: auth → Zod-parse FormData → `checkPermission` → service call → revalidate/redirect. **Permission checks stay in the callers** (action or MCP tool), not in the services — same convention as `services/issues.ts`, where the entry point owns authz and the service owns the transaction. No behavior change; existing integration tests must stay green, plus new PGlite integration tests directly against the extracted service functions (CORE-TEST-005: integration layer is correct for this).

Scope note: extract only what the MCP tools need (create, owner, presence). Full extraction of `updateMachineAction`'s remaining fields (name, PinballMap linking) is NOT required — don't balloon the refactor.

## PR 2 — MCP endpoint, auth, tools

### Route & wiring

- `src/app/api/mcp/[transport]/route.ts` using `createMcpHandler` + `withMcpAuth` + `protectedResourceHandler` for the well-known metadata. Streamable HTTP only (no SSE).
- The well-known route must be reachable at the path MCP clients expect; follow AUTHORIZATION.md's `resourceMetadataPath` guidance. Authorization-server issuer URL derives from the existing `NEXT_PUBLIC_SUPABASE_URL` — expect **zero new env vars**; if one becomes necessary it MUST go through the `next.config.ts` registry (CORE-SEC-009).

### verifyToken (the security core)

1. Extract bearer token; validate as a Supabase JWT. Prefer local verification against the project JWKS (`getClaims`) to avoid a network hop per call; `auth.getUser(token)` via a server client is an acceptable alternative. Either way the validation must reject expired/garbage tokens outright.
2. Resolve `userId` from `sub`, then `getUserAccessLevel(userId)` (`src/lib/permissions/access.ts:24`).
3. **Gate: require `accessLevel === "admin"`** to get past auth at all (v1 posture; per-tool `checkPermission` still runs underneath — defense in depth, and it means a leaked non-admin token gets nothing).
4. Return `AuthInfo` with `extra: {userId, accessLevel}`; ignore OAuth scopes for authorization (they're not access control — verified above).
5. Log one structured line per tool invocation: tool name, userId, `client_id` claim, machine/issue id args, outcome. This is a write-capable production surface; the log line is the audit trail.

### Tool catalog (v1 — exactly these six)

Every mutating tool: Zod-validate args (reuse the schemas' field rules), build ownership context, `checkPermission()` with the same permission id the equivalent action uses, call the service function, return a compact structured result (id, name, new state, canonical URL). Machines are identified by **initials** (the human-friendly key that `createIssue` already uses) with UUID accepted too.

1. `list_machines` (read) — optional name/initials search + presence filter; returns initials, name, presence, owner name, open-issue count. Exists so Claude can disambiguate "the Medieval Madness by the door" before mutating. Respect email privacy (CORE-SEC-007): owner _names_, never emails.
2. `get_machine` (read) — one machine's detail incl. recent open issues.
3. `set_machine_availability` — machine + presence status, enum `on_the_floor | off_the_floor | on_loan | pending_arrival | removed` (`src/lib/machines/presence.ts`). Permission `machines.edit` (ownership context as in `updateMachinePresenceAction`). → `updateMachinePresence`.
4. `add_machine` — name, initials, optional ownerId/presence; PinballMap linking fields optional pass-through (`pinballmapMachineId` or `pinballmapExcluded`+reason). Permission `machines.create`. → `createMachine`. Owner argument accepts a user _name_ lookup helper or UUID — implementer's choice, but "this person is the owner" must be expressible without Tim reciting UUIDs (a small `list_users` read tool restricted to name+id is acceptable if needed; no emails).
5. `set_machine_owner` — machine + owner (name/UUID) or none. Permission `machines.edit`. → `updateMachineOwner`.
6. `create_issue` — machineInitials, title, optional description (plain text → minimal ProseMirror doc — reuse whatever helper the app has), severity (default sensible), optional priority/frequency. Calls `services/issues.createIssue` with `reportedBy = userId` (the authenticated path — NOT `submitPublicIssueAction`, which is the anonymous CAPTCHA path). Generate an `idempotencyKey` per call.

**Excluded from v1 on purpose**: delete/rename machine, comments, assignment, status changes, user administration. Add later if wanted; deletion tools stay out until there's a confirmation story.

### Testing (CORE-TEST-005)

- PGlite integration tests for each tool's underlying path: service functions (PR 1) + a direct-invocation test of each tool handler's validate→permission→service flow with a stubbed `AuthInfo` (member vs admin, bad args, unknown machine).
- Unit tests for `verifyToken` (valid admin JWT, valid non-admin JWT → reject, expired/garbage → reject). Mock the Supabase verification at the SDK boundary (CORE-TEST-006).
- No Playwright; manual handshake verification via the spike + `npx @modelcontextprotocol/inspector` against localhost. Use `localhost`, never `127.0.0.1` (CORE-SEC-008).
- This is auth + server-action-adjacent surface → `pnpm run preflight` before pushing.

### Manual steps (Tim, in Supabase dashboard — not code)

1. Enable OAuth Server on `pinpoint-prod` (Authentication → OAuth Server).
2. Enable Dynamic Client Registration (or pre-register Claude's client if DCR misbehaves in the spike).
3. After PR 2 deploys: `claude mcp add --transport http pinpoint https://<prod-domain>/api/mcp` in Claude Code, complete OAuth consent; later add the same URL as a custom connector in the Claude app (Settings → Connectors), which unlocks mobile.

## Security posture summary

- AuthN: Supabase OAuth 2.1 / standard Supabase JWTs. No secrets stored client-side beyond OAuth tokens Claude manages.
- AuthZ: admin-gate at the door + per-tool `checkPermission` (CORE-ARCH-008) — the matrix stays the single authority.
- Blast radius: six tools, no deletes, no user admin, no email exposure. Structured audit log per call.
- Rate limiting: not required for v1 (admin-JWT-gated endpoint, single user); revisit if tools ever open beyond admin.

## Beads

Epic + two children (one per PR) carry pointers to this spec; the branch name is the recovery path while unmerged.
