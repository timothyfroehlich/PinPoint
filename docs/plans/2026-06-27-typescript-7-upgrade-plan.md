# TypeScript 7 (Native Compiler) Upgrade — Feasibility & Plan

**Date:** 2026-06-27
**Author:** Claude (investigation + empirical validation on this repo)
**Status:** TS 7.0 GA landed 2026-07-08 (7.0.2); the `@typescript/native-preview` nightlies are retired. Phase 1 now runs on the GA dual-install (PP-xu96): `@typescript/native` = `npm:typescript@^7` (native `tsc`, drives the typecheck gate), `typescript` = `npm:@typescript/typescript6@^6` (TS6 JS API for ESLint + `next build`, `tsc6` binary). Phases 2–4 deferred (tests/e2e engine move: PP-8mv1).
**Branch:** `claude/typescript-7-upgrade-plan-o85h0g` (Phase 1 nightly shape: PR #1586; GA swap: PP-xu96)

---

## TL;DR

- **TypeScript 7 = the Go-native rewrite of `tsc`** ("Project Corsa"). It is a new
  _binary_, not a new language version. **7.0 RC shipped 2026-06-18; GA is ~1 month
  out.** Type-checking semantics are ~identical to TS 6.
- **This is NOT a "replace `typescript`" upgrade.** TS 7.0 ships the native `tsc`
  binary but **does not ship a stable JavaScript compiler API ("Strada") until 7.1**
  (several months out). typescript-eslint's type-aware linting and Next.js's build
  type-check both consume that JS API. So `typescript@6` must stay installed.
- **The correct shape is side-by-side:** keep `typescript@6.x` for ESLint + Next,
  **add `@typescript/native-preview` (`tsgo`)** as a devDependency, and **repoint only
  the `typecheck` script** (and its CI job) at the native binary. One-line revert.
- **I validated this against the real codebase today.** Native compiler
  `7.0.0-dev.20260627.2`:
  - **Production `tsconfig.json`: 0 errors — perfect parity with tsc 6.0.3.**
  - **Speed (binary invoked directly): cold ~2.4s vs ~13.8s (≈5.7×), warm ~0.8s vs
    ~3.2s (≈4×).**
  - Test/e2e config surfaces 264 errors **under both compilers** — pre-existing latent
    debt that `tsc` doesn't check today, _not_ a tsgo regression.
- **Effort: ~half a day.** Low risk, high reversibility, real but modest CI payoff
  (the typecheck gate, not the whole `check`).
- **Recommendation: do it now as a small, surgical PR.** Defer the bigger wins
  (type-aware lint on Go, Next native build) to later phases that are gated on
  upstream ecosystem readiness.

---

## 1. What "TypeScript 7" actually is

Microsoft ported the TypeScript compiler from TypeScript-compiled-to-JS over to **Go**
("Project Corsa"). The result is shipped as **TypeScript 7.0**:

- **Native binary**, compiled to machine code, with multi-worker parallel type-checking.
- **~10× faster** is the headline — but that figure is for large monorepos (e.g. Sentry:
  133s → 16s). On a ~674-file project like PinPoint the realistic win is smaller (see §5).
- **Same language, same `tsconfig`, same type system.** It is not a new strictness level
  or a syntax change. Microsoft reports type-check fidelity of ~99% (74 divergent cases
  out of 6,000 error fixtures across the whole test suite).

### Timeline (as of 2026-06-27)

| Milestone                                                        | Date                                                            |
| ---------------------------------------------------------------- | --------------------------------------------------------------- |
| Native previews announced (`@typescript/native-preview`, `tsgo`) | early 2025                                                      |
| 7.0 Beta                                                         | 2026-04-21                                                      |
| **7.0 RC**                                                       | **2026-06-18**                                                  |
| 7.0 GA                                                           | "about a month after RC" → ~July 2026 (estimate, not committed) |
| **7.1 — stable programmatic JS API**                             | **"at least several months" after 7.0**                         |

---

## 2. The one constraint that shapes everything: the Strada API

TS 7.0's native compiler **does not expose the legacy JS compiler API** (codename
"Strada" — `import ts from "typescript"`). Microsoft is rebuilding that programmatic
surface ("Corsa API") and it **won't be stable until TS 7.1**, months away.

Two tools PinPoint depends on consume that JS API:

1. **typescript-eslint** — our **type-aware linting** is heavy. `eslint.config.mjs`
   sets `parserOptions.project: "./tsconfig.json"` and pulls in
   `recommended-type-checked` + `stylistic-type-checked`, plus
   `no-unnecessary-condition`, `no-floating-promises`, `no-misused-promises`,
   `no-unsafe-*`, `consistent-type-imports`, `unbound-method`. All of these build a
   TypeScript `Program` via the JS API. **They cannot run on the native compiler yet.**
2. **Next.js 16 build type-check** — `next build` runs its own type pass through the JS
   API. Next's native (`tsgo`) integration is slated for **~Q3 2026**, alongside TS 7 GA.

Microsoft's own guidance for this transition is exactly the split we propose: _"adopt
`typescript@rc` for `tsc`/CI type-check jobs now, and keep typescript-eslint on a
TypeScript 6 alias so the linter stays green while 7.0 runs in parallel."_ They even ship
a `@typescript/typescript6` compatibility package (re-exports the TS 6 JS API as `tsc6`)
for tools that import `typescript` directly.

**Consequence:** we do not remove or replace `typescript`. We add the native compiler
alongside it and only move the standalone typecheck gate over.

---

## 3. Current toolchain inventory (what touches `tsc` / `typescript`)

| Consumer                                               | How it uses TS                                  | Affected?                              |
| ------------------------------------------------------ | ----------------------------------------------- | -------------------------------------- |
| `pnpm run typecheck` → `tsc --noEmit -p tsconfig.json` | the **only** direct `tsc` caller                | **Yes — this is the migration target** |
| CI `typecheck` job (`.github/workflows/ci.yml:131`)    | runs `pnpm run typecheck`                       | **Yes — repoint with the script**      |
| `eslint` (type-aware)                                  | typescript-eslint builds a `Program` via JS API | **No — stays on TS 6**                 |
| `next build` / `vercel-build`                          | Next's own type pass via JS API                 | **No — stays on TS 6**                 |
| `tsx` (scripts, `migrate-production.ts`)               | esbuild transpile, no type-check                | No                                     |
| Vitest / Vite                                          | esbuild transpile, no type-check                | No                                     |
| `drizzle-kit`                                          | bundled TS handling                             | No                                     |
| Editor (`plugins: [{name:"next"}]`)                    | LSP plugin, tsserver                            | No (CLI ignores LSP plugins)           |

**Findings that de-risk the move:**

- **No emit anywhere.** `tsc` is `--noEmit` only; nothing in the repo runs
  `--declaration`, `tsc --build`, `emitDeclarationOnly`, ts-patch, ttypescript, or custom
  transformers. (TS 7's missing `--declaration`/downlevel-emit gaps are irrelevant to us.)
- **No programmatic compiler-API usage.** Zero files `import`/`require` `"typescript"`.
  No `ts-morph`. So nothing in _our_ code breaks on the Strada removal — only third-party
  tooling does, and that tooling stays on TS 6.
- **`tsconfig` uses only supported options.** `target: ES2022`, `module: ESNext`,
  `moduleResolution: bundler` (TS 7's recommended mode), `paths` **without** `baseUrl`
  (good — TS 7 removes `baseUrl`), `esModuleInterop: true`, `incremental: true`,
  `@tsconfig/strictest`. None of TS 7's removed options (`es5`, `downlevelIteration`,
  `node10`/`classic` resolution, `amd`/`umd`/`systemjs`, `baseUrl`,
  `esModuleInterop:false`) are in use. `--incremental` and project references are ported
  and working in the native compiler.
- **e2e/tsconfig** uses `moduleResolution: NodeNext` — also supported (only the old
  `node10`/`classic` modes were removed). It is not part of the `tsc` typecheck gate
  anyway.

---

## 4. Empirical validation (the "no surprises" centerpiece)

I installed and ran the native compiler against this exact repo today.

**Environment:** Node v22.22.2, native compiler **`7.0.0-dev.20260627.2`** (today's
nightly via `@typescript/native-preview`), tsc baseline **6.0.3**.

### 4.1 Correctness / parity

| Config                                               | tsc 6.0.3    | tsgo (native) | Verdict                         |
| ---------------------------------------------------- | ------------ | ------------- | ------------------------------- |
| `tsconfig.json` (production source — what CI checks) | **0 errors** | **0 errors**  | **Exact parity**                |
| `tsconfig.tests.json` (tests + e2e)                  | 264 errors   | 264 errors    | Pre-existing debt, same on both |

The test-config errors are **identical in count and near-identical in code distribution**
(e.g. `TS2345`: 123 vs 121; `TS2322`: 38 vs 39; every other code identical). These files
are **excluded from the current `typecheck` gate**, so nobody sees them today; they are
caught only partially by ESLint (many type-aware rules are disabled for tests). **This is
latent debt the upgrade _reveals_, not damage it _causes_.** Cleaning it up is a separate,
optional project (see §7, Phase 2).

### 4.2 Speed

Timings are wall-clock on this machine. **The distribution channel matters a lot:**

| Invocation                                                         | Cold      | Warm      |
| ------------------------------------------------------------------ | --------- | --------- |
| `tsc` 6.0.3 (`--noEmit -p tsconfig.json`)                          | ~13.8s    | ~3.2s     |
| `tsgo` via **`npx -p`** (resolves package each run)                | ~6.5s     | ~4.6s ⚠️  |
| **`tsgo` direct binary** (as a real devDependency would invoke it) | **~2.4s** | **~0.8s** |

⚠️ **Gotcha worth flagging:** invoking through `npx -p @typescript/native-preview` adds
**~3.8s of resolution overhead per run** and makes the warm number look _worse_ than tsc.
That overhead vanishes when the package is a normal `devDependency` and the binary is on
`node_modules/.bin`. **Install it; never wire CI/scripts to `npx`.**

**Honest expectation:** ~**4–6× faster** for the standalone typecheck. Real, but note the
caveats in §6.

---

## 5. Recommended architecture: side-by-side

```
typescript           ^6.x      ← UNCHANGED. JS API for ESLint + Next build type-check.
@typescript/native-preview      ← ADD (pinned nightly, or typescript@rc's tsgo at GA).
                                   Provides `tsgo`. Used ONLY by the typecheck gate.
```

- `tsc` (TS 6) stays available; nothing that imports `typescript` changes behavior.
- `tsgo` becomes the engine for `pnpm run typecheck` and the CI typecheck job.
- **Belt-and-suspenders:** `next build` still independently type-checks production source
  at TS 6 semantics in CI and on Vercel. So even in the unlikely event tsgo and tsc 6 ever
  diverge on our code (they don't today), the build job is a second net.

### Why not `typescript@rc` as the primary `typescript`?

Because `typescript@rc` installs the **native** package under the name `typescript`, whose
JS API isn't stable until 7.1. typescript-eslint and Next import `"typescript"` by name and
would break. The `@typescript/typescript6` alias trick exists to work around that, but it's
strictly more moving parts than "keep 6, add native-preview." We choose the simpler path.

---

## 6. Risks, caveats & mitigations

| Risk                                                               | Likelihood             | Impact           | Mitigation                                                                                                                                         |
| ------------------------------------------------------------------ | ---------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| tsgo reports an error tsc 6 doesn't (or vice-versa) on prod code   | **Very low** (0 today) | Med              | Validated 0 divergences now; `next build` TS6 pass is a fallback net; pin the nightly and bump deliberately                                        |
| Nightly `@typescript/native-preview` is unstable/moves daily       | Med                    | Low              | **Pin an exact version**; treat bumps like any dep bump. Switch to GA channel when 7.0 GA lands (~July)                                            |
| Team expects "10×" everywhere, sees little `pnpm run check` change | Med                    | Low (perception) | Set expectations: only the **typecheck** gate speeds up. `check` wall-clock is bounded by **lint + tests**, which stay on TS 6                     |
| `npx` overhead silently negates the win                            | Med if wired wrong     | Med              | Install as devDependency; invoke the `.bin` binary, never `npx`                                                                                    |
| CI runner is linux-x64; native binary is platform-specific         | Low                    | Low              | `@typescript/native-preview` ships per-platform optional deps; CI (ubuntu) + local (mac/linux) both covered. `pnpm install` resolves the right one |
| Editor/IDE type-check still TS 6                                   | n/a                    | None             | Out of scope; LSP is unaffected. Optional: VS Code "TypeScript (Native Preview)" extension for devs who want it                                    |

**The honest payoff ceiling:** the dedicated CI **typecheck** job gets ~4–6× faster, and
local `pnpm run typecheck` drops from ~3–14s to sub-second/~2s. But `pnpm run check` runs
typecheck **in parallel** with `lint` and `test`, and the **type-aware lint job is the long
pole** (it builds its own TS program on the JS API). So **overall `check` and CI wall-clock
improve only modestly** until we also move type-aware linting onto the Go engine — which is
a separate, later phase (§7, Phase 3).

---

## 7. Phased plan

### Phase 1 — Move the typecheck gate to the native compiler _(this PR; ~half a day)_

**Scope:** production `tsconfig.json` typecheck only. No test-file changes, no lint changes.

1. Add the dev dependency, pinned:
   ```
   pnpm add -D @typescript/native-preview@7.0.0-dev.20260627.2
   ```
   (Pin exact; bump deliberately. Re-validate parity on each bump — see step 4.)
2. Repoint the script in `package.json`:
   ```jsonc
   // before
   "typecheck": "tsc --noEmit -p tsconfig.json",
   // after
   "typecheck": "tsgo --noEmit -p tsconfig.json",
   ```
   Keep `typescript@6` in `devDependencies` (ESLint + Next need it). Optionally add a
   `typecheck:tsc6` escape-hatch script that still runs the old `tsc` for A/B comparison
   during the transition.
3. CI: no workflow edit required — the `typecheck` job runs `pnpm run typecheck`, which now
   calls `tsgo`. Confirm the linux-x64 native binary resolves from cached `node_modules`
   (it ships as a platform optional-dep; the existing `node_modules` cache key on
   `pnpm-lock.yaml` covers it).
4. **Acceptance gate:** in CI and locally, `pnpm run typecheck` exits 0 and matches the
   tsc-6 result. (Validated today: 0 vs 0.) Run `pnpm run check` and `pnpm run preflight`
   green before merge.
5. Docs: one line in `docs/DEVELOPMENT.md` / `CLAUDE.md` noting the typecheck engine is now
   `tsgo` while ESLint/Next remain on TS 6.

**Reversibility:** revert is a one-line script change + dropping one devDependency.

### Phase 2 — _(optional, separate)_ Type-check tests + e2e and pay down the 264 errors

The native compiler makes whole-repo type-checking cheap enough to finally gate test/e2e
files. But that means fixing the **264 pre-existing errors** first (mis-typed test
fixtures, a missing module specifier in `email-and-notifications.spec.ts`, `accessLevel`
literal-vs-union mismatches in `unified-report-form.test.tsx`, etc.). This is a real
cleanup project — **file it as its own bead/PR**, don't fold it into Phase 1.

### Phase 3 — _(later, ecosystem-gated)_ Type-aware linting on the Go engine

The biggest remaining CI win is moving type-aware lint off the JS API. Watch:

- **`tsgolint`** (typescript-eslint's Go-powered type-aware linter, ~40 rules) and its
  **Oxlint** integration (reported 59/61 type-aware rules, 20–40× faster than ESLint +
  typescript-eslint). When stable, this is the path to fast type-aware linting.
- typescript-eslint's own native-API support, expected to follow the **TS 7.1 stable API**.

Revisit when one of these is production-ready. This is where the headline speed actually
lands for `pnpm run check`.

### Phase 4 — _(later)_ Next.js native build type-check

When Next.js ships `tsgo`-backed build type-checking (~Q3 2026, alongside TS 7 GA), adopt
it so the production build type pass is also native. Until then Next stays on TS 6 — and
usefully serves as our parity safety net (§5).

---

## 8. Effort & recommendation

- **Phase 1: ~half a day** (dependency + one script line + CI verify + docs + PR review).
  Low risk, fully reversible, validated against the real codebase with zero divergences.
- **Recommendation: proceed with Phase 1 now**, as a small surgical PR. Pin the nightly;
  switch to the TS 7.0 GA channel when it lands (~July). Treat Phases 2–4 as independent,
  separately-scoped follow-ups gated on (2) our own cleanup appetite and (3–4) upstream
  readiness.
- **What we explicitly are NOT doing in Phase 1:** removing/replacing `typescript`; moving
  ESLint or Next off the JS API; type-checking test files; chasing the "10×" headline. The
  win here is a faster, parity-clean typecheck gate with a trivial blast radius.

---

## Appendix A — Raw measurements (2026-06-27)

```
Native compiler version: 7.0.0-dev.20260627.2   (Node v22.22.2, pnpm 10.2.0)
Baseline tsc:            6.0.3

Parity:
  tsconfig.json       tsc6: 0 errors    tsgo: 0 errors        (exact)
  tsconfig.tests.json tsc6: 264 errors  tsgo: 264 errors      (pre-existing; codes within ±2)

Speed (wall clock):
  tsc6   cold ~13.8s   warm ~3.2s
  tsgo   via npx -p:    cold ~6.5s   warm ~4.6s   (npx adds ~3.8s/run overhead)
  tsgo   direct binary: cold ~2.4s   warm ~0.8s   ← representative of devDependency install
```

## Appendix B — Sources

- [Announcing TypeScript 7.0 RC — TypeScript devblog](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-rc/)
- [Announcing TypeScript 7.0 Beta — TypeScript devblog](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-beta/)
- [Progress on TypeScript 7 — December 2025](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/)
- [Announcing TypeScript Native Previews](https://devblogs.microsoft.com/typescript/announcing-typescript-native-previews/)
- [`@typescript/native-preview` — npm](https://www.npmjs.com/package/@typescript/native-preview)
- [microsoft/typescript-go (staging repo)](https://github.com/microsoft/typescript-go)
- [typescript-eslint/tsgolint](https://github.com/typescript-eslint/tsgolint) · [Oxlint type-aware linting](https://oxc.rs/docs/guide/usage/linter/type-aware) · [typescript-eslint #10940 (use tsgo for type info)](https://github.com/typescript-eslint/typescript-eslint/issues/10940)
- [Next.js discussion #81472 — Support typescript-go for builds](https://github.com/vercel/next.js/discussions/81472)
- [TypeScript 7.0 RC moves Go rewrite into mainline — Visual Studio Magazine](https://visualstudiomagazine.com/articles/2026/06/22/typescript-7-0-rc-moves-microsofts-go-rewrite-into-the-mainline-compiler.aspx)
