---
name: pinpoint-environment
description: PinPoint environment-variable policy and browser-facing local URL conventions. Use when adding or changing an environment variable; editing next.config.ts, .env files, deployment or workflow configuration; or configuring local URL defaults in browser-facing code or tests.
---

# PinPoint Environment

## Sources of truth

`docs/ENV_VARS.md` is the canonical environment-variable reference. Update it for every new variable, including local-only ones. `docs/NON_NEGOTIABLES.md` remains the canonical catalog for `CORE-SEC-008` and `CORE-SEC-009`.

For production deployment mechanics, Vercel configuration, and migration timing, load `pinpoint-deployment` as well.

## Add or change a variable

1. Decide its scope before naming it: browser-visible values use `NEXT_PUBLIC_`; server values do not. A value that is secret in any scope must never be `NEXT_PUBLIC_` or have a public/default fallback.
2. Decide whether the app can be meaningfully usable if it is unset in production. Add only those required variables to `next.config.ts`'s `assertVercelDeploymentEnv` registry. Put optional configuration in `docs/ENV_VARS.md` §4.2 instead.
3. Set a required production variable in every needed Vercel environment before merging the registry change. The registry turns an absent setting into a failed deployment; it does not configure Vercel.
4. Keep safe local defaults and the documented production configuration in sync with the code. Do not silently substitute a secret fallback.

## Browser-facing local URLs

Use `localhost`, not `127.0.0.1`, for browser-facing local URLs: app base URLs, cookies, redirects, Playwright browser configuration, and similar client-visible settings. Cookie host matching treats them differently.

Server-to-server connections, CSP source lists, and validation allowlists may use `127.0.0.1` when that is what the service actually binds to; do not mechanically rewrite those.
