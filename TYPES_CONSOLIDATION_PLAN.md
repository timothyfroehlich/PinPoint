# Types Consolidation Plan v2 (Parallel Workstreams)

Goal: Make `src/lib/types` the single, obvious source of truth for all application-consumed TypeScript types. Every consumer imports types from `~/lib/types` (or its sub-exports). Generated and schema-bound types remain where they are authored/generated, but are re-exported from `src/lib/types` to ensure discoverability and reuse.

This version structures the work so multiple agents can execute in parallel with minimal conflicts. It reflects current repo state and adds clear acceptance criteria, dependencies, and PR checklists per workstream.

## Principles (Non‑Negotiable)

- Single import path: All app and server code import types from `~/lib/types`.
- One definition per semantic shape: No duplicate domain types; prefer reuse and composition.
- Clear boundaries: Keep DB-layer (snake_case) types separate from app/domain (camelCase) types.
- Type‑only barrels: Barrel files must only export types to avoid runtime cycles.
- Co‑locate value code, centralize type code: Functions live near usage; types live in `src/lib/types` (with re-exports for generated/schema types).
- Component props stay local: Do not centralize component-only props; centralize only domain/API/DTO shapes.

## Ideal Folder Layout

```
src/lib/types/
  index.ts                 # Single barrel for all commonly used types
  api.ts                   # Domain/API response types (camelCase), lists, nested relations
  filters.ts               # Cross-module filter DTOs (IssueFilters, MachineFilters, etc.)
  auth.ts                  # App auth types (org context, role/permission shapes), plus Supabase auth re-exports
  db.ts                    # Re-export Drizzle model types as Db.* aliases (snake_case), no value imports
  supabase.ts              # Re-export Supabase Database types (from generated) under a stable import path
  search.ts                # Re-export z.infer types for search params (IssueSearchParams, MachineSearchParams)
  utils.ts                 # Type-level helpers (CamelCased, SnakeCased, DrizzleToCamelCase), re-exported from utils
  guards.ts                # Shared type signatures for guards/results (e.g., ValidationResult<T>), values live elsewhere
```

Notes:
- Keep value-level implementations in feature modules (e.g., `type-guards.ts`, `machine-response-transformers.ts`). If those files declare types, move the type declarations into `~/lib/types` and import them from there.
- Keep generated files where they are (e.g., `src/types/supabase.ts`) and re-export their types from `~/lib/types/supabase.ts`.
- Current state: `src/lib/types/index.ts`, `src/lib/types/api.ts`, and `src/lib/types/filters.ts` exist. `api.ts` still includes component props and filter/input duplicates that must be moved/removed (see WS‑02, WS‑03).

## Canonical Types and Ownership

- Domain/API types: Owned by `~/lib/types/api.ts`.
- Filters/DTOs: Owned by `~/lib/types/filters.ts`.
- App auth and org context: Owned by `~/lib/types/auth.ts`.
- DB model interfaces: Owned by `~/server/db/schema/*`, re-exported as aliases from `~/lib/types/db.ts`.
- Supabase Database: Owned by generated `src/types/supabase.ts`, re-exported from `~/lib/types/supabase.ts`.
- Zod-inferred params: Schemas stay with implementation; types are re-exported from `~/lib/types/search.ts`.
- Utility generics (e.g., `DrizzleToCamelCase`): defined where implemented, re-exported via `~/lib/types/utils.ts`.

## Naming Conventions

- Database (snake_case): Use `Db.*` namespace when importing via `~/lib/types` barrel for server code.
- API/Domain (camelCase): Suffix with `Response` for outgoing shapes (`UserResponse`, `IssueResponse`). Keep nested relation types discoverable via top-level types.
- Filters/Inputs: Suffix or group by purpose (`IssueFilters`, `MachineFilters`, `RoleAssignmentInput`).
- Results/Guards: Use `ValidationResult<T>`, `OperationResult<T>`, and specific discriminated unions for status.

## Import Rules (Examples)

- App services/components: `import { IssueResponse, IssueFilters } from "~/lib/types"`.
- Server routers: `import { RoleResponse } from "~/lib/types"` and `import type { Db } from "~/lib/types"` to access `Db.Role`, etc.
- Avoid importing from `src/types/supabase.ts` or `src/server/db/types.ts` directly; prefer `~/lib/types` re-exports.

---

## Parallel Workstreams

Each workstream lists scope, dependencies, deliverables, acceptance criteria, and a PR checklist. Use short-lived PRs per WS to reduce merge conflicts.

WS‑01 — Types Surface Scaffolding
- Scope: Add missing modules: `auth.ts`, `db.ts`, `supabase.ts`, `search.ts`, `utils.ts`, `guards.ts`. Wire exports in `index.ts` using `export type { ... }` or `export type * as Db`.
- Dependencies: None.
- Deliverables: New files under `src/lib/types` with type-only re-exports; updated `index.ts`.
- Acceptance: Type-check passes; no runtime exports from `~/lib/types`; no consumer import changes required.
- PR checklist: Add files, update `index.ts`, run `tsc -p tsconfig.json`.

WS‑02 — API Types Hygiene
- Scope: Restrict `src/lib/types/api.ts` to domain/API shapes only. Remove component props and duplicate filter/input DTOs. Keep/define canonical: `IssueResponse`, `IssueWithRelationsResponse`, `MachineResponse`, `LocationResponse`, `RoleResponse`, `PermissionResponse`, `ModelResponse`, `MachineForIssues`.
- Dependencies: WS‑01 (exports exist).
- Deliverables: Slim `api.ts` focused on API/domain; component props moved local or to a dedicated UI file if truly shared.
- Acceptance: No component props under `src/lib/types/api.ts`; filters live in `filters.ts`; build passes.
- PR checklist: Move/remove types; update imports in components if needed.

WS‑03 — Filters Unification
- Scope: Make `IssueFilters` and `MachineFilters` canonical in `src/lib/types/filters.ts`. Replace duplicates in DAL, utilities, and components.
- Dependencies: WS‑01 (types surface stable).
- Deliverables: All references import from `~/lib/types` (or `~/lib/types/filters`). Remove local duplicates.
- Acceptance: `rg` finds only the canonical definitions in `src/lib/types/filters.ts` (allow docs/tests).
- Affected files (current duplicates):
  - IssueFilters: `src/lib/dal/issues.ts`, `src/lib/issues/filterUtils.ts`, `src/lib/types/api.ts`, `src/components/issues/FilterToolbar.tsx` (local-only allowed), pages importing types.
  - MachineFilters: `src/lib/dal/machines.ts`, `src/lib/types/api.ts`.
- PR checklist: Swap imports, delete dupes, adjust local component-only types as needed.

WS‑04 — MachineForIssues Unification
- Scope: Use a single `MachineForIssues` under `~/lib/types/api`. Remove duplicates in `src/lib/types/gameInstance.ts` and `src/lib/utils/machine-response-transformers.ts`. Update routers/services.
- Dependencies: WS‑02 (final canonical lives in `api.ts`).
- Deliverables: One canonical interface; transformer utils reference canonical type.
- Acceptance: `rg -n "interface MachineForIssues"` returns one result under `src/lib/types/api.ts`.
- PR checklist: Update imports, remove duplicate interfaces, ensure transformer return types align.

WS‑05 — Auth & Org Context Split
- Scope: Add `auth.ts` to house `OrganizationContext` (app) and re-export Supabase auth/session types as type-only imports from `~/lib/supabase/types`. Provide `SupabaseOrganizationContext` alias where needed.
- Dependencies: WS‑01.
- Deliverables: `src/lib/types/auth.ts` with app-level shapes; `index.ts` re-exports.
- Acceptance: Server/auth code compiles when importing from `~/lib/types`.
- PR checklist: Add file, update imports in `src/server/auth/**` and routers if applicable.

WS‑06 — Zod Search Params Re‑exports
- Scope: Add `src/lib/types/search.ts` re-exporting `z.infer` types from existing `~/lib/search-params/*` modules.
- Dependencies: WS‑01.
- Deliverables: `search.ts` with type-only exports; `index.ts` re-exports.
- Acceptance: Consumers import from `~/lib/types`.
- PR checklist: Add file, swap imports in pages/components/services.

WS‑07 — DB Types Barrel & Boundary
- Scope: Add `db.ts` exporting `export type * as Db from "~/server/db/types";`. Encourage server-only usage via `import type { Db } from "~/lib/types"`.
- Dependencies: WS‑01.
- Deliverables: `db.ts` (or `index.ts` change) and docs notes. No app-side imports of `Db.*`.
- Acceptance: ESLint guardrails block app-side server DB imports (see WS‑08).
- PR checklist: Add file and docs cross-links.

WS‑08 — Lint/CI Enforcement
- Scope: Strengthen ESLint to:
  - Disallow imports to `~/server/db/**` and block `@supabase/supabase-js` `createClient` in app code (already present).
  - Flag exported `type`/`interface` declarations for domain shapes outside `src/lib/types` (allow component props/tests/generated).
  - Prefer imports from `~/lib/types` for known names.
  - CI script to detect duplicate type names outside `src/lib/types`.
- Dependencies: None (can start now). Coordinate with WS‑03/04 to avoid churn.
- Deliverables: Updated `eslint.config.js` and a simple `pnpm ci:check-types-drift` script.
- Acceptance: Lint fails on new out-of-place domain types; CI job runs in PRs.
- PR checklist: Add rules, update scripts, document exceptions.

WS‑09 — Codemods
- Scope: Provide jscodeshift codemods for swapping imports to `~/lib/types` and deleting duplicate declarations.
- Dependencies: WS‑01/02/03 planned shapes finalized.
- Deliverables: `scripts/codemods/*` with README and dry-run instructions.
- Acceptance: Dry-run shows intended changes; run per-directory to minimize conflicts.
- PR checklist: Add scripts, usage docs, sample commands.

WS‑10 — Docs & Adoption
- Scope: Update references pointing to `~/lib/types`, add a Type Ownership matrix, and link to Non‑Negotiables.
- Dependencies: None.
- Deliverables: Docs updates; a small appendix in this plan for live hotspots.
- Acceptance: Onboarding path is clear; links resolve.
- PR checklist: Update `docs/CORE/NON_NEGOTIABLES.md` (already v2), add/refresh a `docs/CORE/TYPE_INVENTORY.md` if useful.

---

## Parallelization Map

- Start immediately: WS‑01, WS‑06, WS‑08, WS‑10.
- In parallel after WS‑01: WS‑02 (API hygiene), WS‑03 (Filters), WS‑07 (DB barrel).
- Clustered by area to reduce conflicts:
  - Data layer focus: WS‑03 (DAL filters), WS‑04 (transformers/routers).
  - UI focus: WS‑03 (component imports), WS‑10 (docs).
- Sequence-sensitive:
  - WS‑04 depends on WS‑02 selecting the canonical `MachineForIssues` location.
  - WS‑09 runs after WS‑01/02 to avoid chasing moving targets.

---

## Current Hotspots (Inventory)

Use these as targets for WS‑03/04. Allow duplicates in docs/tests.

- IssueFilters duplicates:
  - `src/lib/dal/issues.ts`
  - `src/lib/issues/filterUtils.ts`
  - `src/lib/types/api.ts`
  - `src/components/issues/FilterToolbar.tsx` (component-local acceptable)
  - `src/app/issues/page.tsx` (imports type)

- MachineFilters duplicates:
  - `src/lib/dal/machines.ts`
  - `src/lib/types/api.ts`
  - `src/app/machines/page.tsx` (imports type)

- MachineForIssues duplicates:
  - `src/lib/types/api.ts` (canonical target)
  - `src/lib/types/gameInstance.ts`
  - `src/lib/utils/machine-response-transformers.ts`
  - `src/server/api/routers/machine.core.ts` (consumes)

- Role/Permission response shapes:
  - Canonical in `src/lib/types/api.ts`; ensure `src/server/api/routers/role.ts` uses them.

---

## Tooling & Automation

- Codemods: Provide jscodeshift scripts to swap imports to `~/lib/types`.
- Lint rules: `no-restricted-imports` and `no-restricted-syntax` to prevent drifting definitions (augment existing rules).
- CI check: Script to scan for duplicate type/interface names outside `src/lib/types` (allowlist for component props/tests/generated).

---

## Risks & Mitigations

- Runtime cycles: Keep barrels type-only; avoid exporting values from `~/lib/types`.
- Generated drift: Treat `~/lib/types` as re-export only for generated/schema types; do not edit generated sources.
- Over‑centralization: Component-only props stay local; promote only domain-level shapes to `~/lib/types`.
- Merge conflicts: Prefer small PRs per WS; run codemods per-directory; coordinate WS‑03/04 changes by area.

---

## Success Criteria

- All domain/API and cross-module DTO types importable from `~/lib/types`.
- No duplicate type declarations with overlapping names across the repo.
- Lint/CI prevents new out-of-place type declarations.
- `api.ts` contains only domain/API shapes; component props live locally.

---

## Definition of Done (Per WS)

- Code compiles with `pnpm typecheck` and lints cleanly for the touched scope.
- `rg` checks show only canonical definitions where expected.
- PR includes a short “Acceptance” section mapping to criteria above.

