---
applyTo: "**/actions.ts,src/server/**/*.ts,src/lib/**/*.ts"
---

# Server Actions & server code

## Permissions (CORE-ARCH-008)

- Every mutation checks authorization via `checkPermission()` from `~/lib/permissions/helpers`. Flag any inline role comparison (`if (user.role === "admin")`) or bespoke permission helper defined outside `src/lib/permissions/`.
- `matrix.ts` is the source of truth: `true` = unconditional access, `"own"` = only resources the user created. If this action's checks and `src/lib/permissions/matrix.ts` disagree, flag it.

## Side effects & transactions (CORE-ARCH-011)

- Flag any external or non-transactional effect inside a `db.transaction(...)` callback: HTTP requests, email, Discord, blob upload, Vault RPC. Fetch inputs before the transaction; deliver effects after commit using `after()` + `planNotification` / `dispatchNotification`. A runtime tripwire throws `SideEffectInTransactionError`.

## Validation & shape

- Flag a server action that reads `FormData` without validating it through a Zod schema before use.
- Flag returning full ORM rows to the client from an action when a trimmed shape would do (mirror of the minimal-payload rule).

## Auth data source (CORE-SSR-007)

- Application code reads user data from `user_profiles`, never from Supabase's internal `auth.users`. Exceptions: `supabase/seed.sql` triggers and PGlite test setup.

## PinballMap (CORE-PBM-001)

- All PinballMap access goes through the `~/lib/pinballmap` client seam (documented JSON API, Vault-stored token, descriptive User-Agent, 429 backoff). Flag direct `fetch` to `pinballmap.com` or any crawl of its HTML.
