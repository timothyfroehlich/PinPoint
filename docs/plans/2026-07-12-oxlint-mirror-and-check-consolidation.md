> **Record — superseded by the implementation (2026-08-02, PR #1800).** This is the
> 2026-07-12 spike/design doc, kept for its reasoning and measurements. Two of its
> predictions did not hold and are corrected in
> `docs/plans/2026-06-27-typescript-7-upgrade-plan.md` Phase 3:
>
> - **"check ~35s → ~2–3s"** — actual is **~8.4s**. Removing unit tests and (later) pytest
>   did most of the work; the oxlint swap alone barely moved `check`, because `check` runs
>   its legs in parallel. The new long pole is `format:fix` (6.9s).
> - **`no-unnecessary-type-assertion` "false positive"** — re-tested on stable oxlint, its
>   one hit was a genuine redundant `as` in `src/lib/notifications/dispatch.ts`. The rule is
>   in the mirror and the code was fixed.
>
> Its `prefer-optional-chain` call **did** hold: still over-reports on stable, still
> excluded, now documented in `AGENTS.md` so it isn't restored by mistake.

# Oxlint local mirror + `check` consolidation (PP-4zcj)

**Date:** 2026-07-12 · **Author:** Claude-OxlintSpike · **Branch:** feature/pp-4zcj-oxlint
**Status:** spike complete (GO given by Tim), implementation in progress.

## Why

Two synergistic changes, one PR:

1. **`pnpm run check` drifted off its "fast gate" promise.** AGENTS.md calls it a ~12s
   static gate, but unit `test` grew to ~30s and now dominates check's parallel wall-clock
   (~35s measured). `check` isn't where unit tests conventionally live, and they don't gate
   commits today anyway (pre-commit runs lint-staged + typecheck + format, not test; CI runs
   `test-unit` as its own required job). → **Remove unit tests from `check`.**
2. **Type-aware ESLint is the lint long pole** (~12.9s / ~3.0 GB RSS). Oxlint's tsgolint
   type-aware engine does the same work in ~0.8s / ~870 MB. → **Swap check's lint leg to an
   oxlint local mirror**, keeping full ESLint authoritative in CI.

With unit tests out, lint becomes check's long pole again, so the oxlint swap actually lands:
**check ~35s → ~2–3s.**

## Spike evidence (measured, this branch)

- oxlint `--type-aware` over `src/`: 0.83s median / ~870 MB (vs ESLint 12.9s / 3.0 GB) — ~15×.
- Slim residual ESLint (no type-info): 2.23s. Combined mirror ~3s — ~4–6× on the lint path.
- Zero false negatives on seeded type-aware violations; `no-misused-promises`
  `checksVoidReturn.attributes:false` faithful.
- 2 false POSITIVES (oxlint stricter than typescript-eslint): `prefer-optional-chain`,
  `no-unnecessary-type-assertion` → dropped from the mirror, kept CI-only.
- jsx-a11y: oxlint did NOT fire on a seeded probe ESLint caught → keep in residual ESLint.

## Architecture (agreed with Tim, unchanged)

- `eslint.config.mjs` stays **complete + authoritative**. CI's `lint` job (full ESLint) is
  **unchanged** — lint isn't on CI's critical path (E2E is). No coverage bet on oxlint in CI.
- Local `check` runs the **mirror**: `oxlint --type-aware` (type-checked bulk) + a **slim
  residual ESLint** pass (plugins oxlint can't faithfully run).
- **Drift fails safe:** anything the mirror misses, CI full-ESLint catches (CI-only failure,
  never silent loss).

## Coverage split

- **oxlint `--type-aware`** owns: typescript-eslint `recommended-type-checked` +
  `stylistic-type-checked` + our type-aware tuned rules (`no-floating-promises`,
  `no-misused-promises` w/ options, `no-unsafe-*`, `restrict-template-expressions`, etc.),
  plus the syntactic TS rules it natively covers (`ban-ts-comment`, `consistent-type-imports`,
  `explicit-function-return-type`, `no-restricted-imports`, `no-empty-pattern`,
  `no-unnecessary-condition`). **Minus** the 2 FP rules.
- **Residual slim ESLint** (`eslint.residual.mjs`, NO projectService) owns the plugins oxlint
  can't faithfully run: `unused-imports`, `@eslint-community/eslint-comments`,
  `better-tailwindcss`, `pinpoint/no-side-effects-in-transaction` (custom), `react-hooks`,
  `promise`, `jsx-a11y`. All syntactic ⇒ cheap.
- **Dropped from mirror, CI-only:** `prefer-optional-chain`, `no-unnecessary-type-assertion`
  (FP), `no-restricted-syntax` (e2e @test.com nudge; not impl in oxlint).

The exact per-rule split is **verified in Phase 2 by a seeded-fixture union test**: for every
rule the full ESLint config catches, oxlint OR residual must catch it too (no false negatives).

## File changes

### Config

- `.oxlintrc.json` (new) — type-aware on, src scope, overrides mirrored, FP rules dropped, no
  jsPlugins; header comment: "mirror — keep in sync with eslint.config.mjs; CI full ESLint is
  authoritative; drift fails safe."
- `eslint.residual.mjs` (new) — slim residual pass. Composed from residual block objects shared
  with `eslint.config.mjs` (export blocks from a small `eslint.shared.mjs`) so there's one
  source of truth per residual plugin, no drift.
- `eslint.config.mjs` — behavior UNCHANGED; only refactored to import the shared residual blocks.
- `tsconfig.app.json` + `tsconfig.tests.json` — add `"outDir": "./.oxlint-tsbuild"` (inert for
  all real gates: typecheck `--noEmit`, next build noEmit, drizzle reads root) with a comment;
  resolves tsgolint's TS5055 emit-over-input on the `.mjs` custom rule imported by its test.
- `.gitignore` — add `.oxlint-tsbuild/`.

### Scripts (package.json)

- `lint` — UNCHANGED (`eslint src/ --quiet`; authoritative, used by CI + lint:fix + preflight).
- `lint:_oxlint` (new, internal) — `oxlint --type-aware`.
- `lint:_residual` (new, internal) — `eslint --config eslint.residual.mjs src/ --quiet`.
  (`_` prefix = plumbing, matches repo `db:_*` / `test:_*` convention; not a user-facing choice.)
- `check` — drop `test`; replace `lint` with `lint:_oxlint lint:_residual`.
- lint-staged — UNCHANGED (full `eslint --fix` on staged files = authoritative, fast staged-only).

### Hooks

- `.husky/pre-commit` — DROP the redundant full `pnpm run format` (lint-staged already
  prettier-writes staged files; whole-tree format-check is CI's job and wrongly blocks on
  unstaged drift). Keep `lint-staged` (auto-fix staged) + `pnpm run typecheck` (cross-file).
  _(Decision pending Tim — see below.)_

### Docs / skills (canonical only; dated plans/specs under docs/plans|superpowers left as records)

- `AGENTS.md` — §2.2.2 (check no longer includes unit; new timing), §5 key-commands table
  (check description + timing), §5 "Which tests to run" (unit tests now via `pnpm run test`),
  §9 "Before you push" (check = static floor), Type-check-engine section (+ "Lint engines"
  paragraph: mirror vs authoritative CI ESLint, drift-fails-safe, mirror-maintenance rule).
- `README.md:121`, `docs/DEVELOPMENT.md:50` — check description.
- `docs/ESLINT_RULES.md` — add lint-engine section (oxlint mirror + authoritative ESLint).
- `docs/CI_WORKFLOW_SETUP.md` — note CI still runs full ESLint (unchanged).
- Skills: `pinpoint-testing` (62, 74, 85), `pinpoint-e2e` (30, 41), `pinpoint-pr-workflow` (30),
  `pinpoint-security` (99) — check composition + timing.
- `docs/NON_NEGOTIABLES.md:377` — fix stale claim (says `no-restricted-syntax`; the backstop is
  the custom `pinpoint/no-side-effects-in-transaction` rule).
- Purge the "~12s" magic number → replace with accurate figures or "fast (~3s)".

## Where unit tests live now (Tim: option 1)

CI `test-unit` (required) + `preflight` (non-trivial changes) + on-demand `pnpm run test` /
`test:watch`. NOT added to pre-push (would re-add ~30s per push). Regressions surface at
explicit test run or CI.

## Verification

- Seeded-violation union test: floating-promise → `lint:_oxlint`; raw palette class,
  `fetch` in `db.transaction`, jsx-a11y `alt-text`, a react-hooks violation → `lint:_residual`.
- For every rule in the full config, confirm oxlint∪residual catches it (no false negatives).
- `pnpm run check` green + before/after wall-clock table in PR body.
- `pnpm run lint` (full ESLint) still green — authoritative path untouched.
- `src/test/eslint/*` custom-rule tests still pass.
- `pnpm run build` once (ESLint config composition changed; next build type-checks via TS6).
- PR via pinpoint-pr-workflow: ready-for-review, Copilot threads resolved, merge-pr.sh, watch deploy.
