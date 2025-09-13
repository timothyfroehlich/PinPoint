# Feature Specs Guidelines (docs/feature_specs)

Scope: All files under `docs/feature_specs/`.

Purpose: Provide a consistent, reviewable spec for each user‑visible feature. These specs are living documents and MUST be kept current as behavior changes.

## Required Structure (in order)

1. Feature overview (one paragraph)
2. Last reviewed / Last updated (ISO date)
3. Key source files (paths + brief purpose)
4. Detailed feature spec (capabilities & behavior)
5. Security / RLS spec (link to CORE docs; summarize effective rules)
6. Test spec (pyramid: unit → integration → E2E; include acceptance criteria)
7. Associated test files (current + planned paths)

Each section is mandatory unless explicitly marked optional in that file.

Optional but Recommended:

- UI Spec (concise)
  - Screens & Routes: URLs, breadcrumbs, redirects
  - States: loading/empty/error/auth-gated/validation
  - Form Contract: fields, defaults, validation messages, button enable/disable, keyboard behavior
  - Components & A11y: shadcn components used, labels/aria roles, focus order
  - Responsive: breakpoint behavior
  - Copy: key CTAs, inline errors, toasts
  - Selectors: stable `data-testid` map for E2E
  - Analytics: events fired (if any)

## Authoring Rules

- Single source of truth: Specs must reflect the current code. If you make behavior changes, update the spec in the same PR.
- Review freshness: Update “Last reviewed” after verification. Per CORE policy, content older than 5 days must be re‑verified before use.
- Cross‑reference: Link relevant constraints in `docs/CORE/` (e.g., `DATABASE_SECURITY_SPEC.md`, `NON_NEGOTIABLES.md`).
- Paths over prose: Prefer listing concrete file paths and exported symbols over vague descriptions.
- Non‑goals & edge cases: Capture notable exclusions and tricky states in the Detailed spec.

## Naming & Location

- One feature per file under `docs/feature_specs/`.
- Filename: kebab‑case, e.g., `issue-creation.md`.
- Keep related assets (small diagrams, screenshots) alongside the spec using the same kebab prefix.

## Test Spec Expectations

- Follow the testing pyramid: many unit tests for pure logic; fewer integration tests for DAL/tRPC; E2E for full journeys.
- Follow `docs/CORE/TESTING_GUIDE.md` for test type selection, naming, placement, and templates. Use shared seed constants and helpers; avoid ad‑hoc patterns.
- List "Associated test files" that exist today and "Planned test files" with suggested paths.

## PR & Review Policy

- Any PR changing a feature’s behavior MUST update its spec (and bump Last updated/reviewed).
- Reviewers should reject behavior‑changing PRs without corresponding spec updates.
- When introducing a new feature, include its spec in the same PR.

## Optional Enhancements (recommended)

- Decisions & assumptions log
- Open questions
- Telemetry/KPIs and operational alerts
- UX states/flows (links or brief diagrams)
- Risks & mitigations
- Change log of notable edits (link to PRs)

## Minimal Template (copy/paste)

```
# <Feature Name>

## Feature Overview
<1 paragraph summary>

## Last Reviewed / Last Updated
- Last Reviewed: YYYY-MM-DD
- Last Updated: YYYY-MM-DD

## Key Source Files
- `path/to/file.ts`: Purpose

## Detailed Feature Spec
- Capabilities
- States & transitions
- Edge cases / non-goals

## Security / RLS Spec
- Summary + links to `docs/CORE/DATABASE_SECURITY_SPEC.md`

## Test Spec
- Unit: …
- Integration: …
- E2E: …
- Acceptance criteria: …

## Associated Test Files
- Current: `path/to/test.ts`
- Planned: `suggested/path/to/test.ts`
```
