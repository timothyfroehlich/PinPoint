---
name: pinpoint-e2e
description: >-
  E2E testing guide for PinPoint (Playwright, isolation, Mailpit, Supabase).
  Covers local/preview dev autologin and opt-outs, global-setup reset chains,
  the cleanupTestEntities direct-database helper, selector strategy (roles and labels
  first, testids next, CSS never), auth roles and loginAs/STORAGE_STATE
  scaffolding, the assertNoA11yViolations axe-core accessibility scan, and
  session timeout debugging. Use when authoring, debugging, or fixing Playwright
  E2E tests, choosing selectors or auth roles, adding an accessibility check,
  diagnosing unexpected authentication or guest states, or investigating
  seed/cleanup crosstalk.
---

# PinPoint E2E Testing Skill

This skill guides you through the E2E testing infrastructure of PinPoint.

## Before Writing an E2E Test (30-Second Pre-Flight)

Run this checklist BEFORE typing `test("...", async ({ page })`. The 2026-05 audit found that ~3/4 of new E2E specs that get filed are misallocated and could land at a cheaper, faster, more reliable layer.

1. **What bug class does this catch?** See `pinpoint-testing` skill § "Bug Classes & Cheapest Catching Layer". Class A/B/C/E/G/H/I should not be E2E — integration or RTL unit is the right home.
2. **Does an integration or unit test already cover this feature?** Run `rg -l "your-keyword" src/test/ src/` first (substitute the actual feature keyword). The audit found that agents create new specs because they can't see the existing tests — most of the time you should be extending an existing file, not creating a new one. See `pinpoint-testing` skill § "Where Existing Coverage Lives".
3. **Class-J self-check (CORE-TEST-006, "Test What We Own")**: Does this spec hit any URL outside `localhost`, `127.0.0.1`, or our owned local stack (Mailpit, PGlite, local Supabase)? If yes → STOP. Mock the SDK at the boundary in `src/lib/<service>/client.test.ts`. Live Discord, real OAuth provider redirects, vendor email-template parsing are violations.
4. **Would the assertion be the same if I called the Server Action directly with PGlite seeded data?** If yes → integration test, not E2E. The browser overhead buys nothing.
5. **Is this a genuine multi-step user journey** that spans two or more page renders (e.g. login → mutate → verify across pages)? If no → almost certainly not E2E.

If all five say "E2E is the right layer", write it. Otherwise, the cheapest layer that catches the bug class wins.

## Quick Start

- **Run Smoke Tests**: `pnpm run smoke` (Fast, critical paths)
- **Run Full Suite**: `pnpm run e2e:full` / `e2e:all` (Comprehensive — CI's job by default; three parallel Chromium workers plus a Supabase stack and a Next server, peaking at several GB)
- **Debug Mode**: `pnpm exec playwright test e2e/path/to/test.spec.ts --debug`

## Web Server: `next dev` or a Production Build

`playwright.config.ts` starts the app itself, and `PLAYWRIGHT_WEB_SERVER` picks which server:

- **Unset or `dev`** (default): `pnpm run dev`. Local runs, `preflight`, and crabbox jobs use this. Playwright reuses a server already on the port outside CI.
- **`start`**: `next build && next start` with `VERCEL_ENV=development` and `MOCK_BLOB_STORAGE=true`, so `isProductionRuntime()` stays false and test-only behavior keeps working under `NODE_ENV=production`. All CI E2E jobs set it, because `next dev` compiles each route on first visit and that compile can exceed the 20s navigation timeout (PP-rj2x, PP-po96). It never reuses a running server, and it refuses a checkout that holds `.env.production` or `.env.production.local`, which `next build` would load.

A production build sends the local Supabase auth container (GoTrue) several times more `/user` calls than `next dev`, because every link prefetch runs the middleware's `getUser()`. GoTrue opens a new Postgres connection for most queries, and its network namespace can run out of ephemeral ports (TIME_WAIT pinned at the 28k limit). `/user` then returns 500 with `cannot assign requested address`, and tests look like lost sessions: a report submits anonymously, a member action does nothing, a login stays on `/login`. `.github/actions/setup-supabase` therefore sets `net.ipv4.tcp_tw_reuse=1` in the auth container's namespace and fails the job if it does not stick. The setting is lost if the auth container restarts: global setup's full-reset fallback (`supabase db reset`, or `db:reset` on a remote backend) does that, and global setup then prints a warning. The crabbox `smoke` and `e2e-full` jobs apply the same setting themselves. A local stack run under `start` needs it too; under `dev` it does not (PP-izj5).

The switch is deliberately not keyed on `CI`: crabbox jobs set `CI=1` and stay on dev. To reproduce a CI-only failure, set `PLAYWRIGHT_WEB_SERVER=start` on the run. The build runs inside the Playwright step, so it inlines the `NEXT_PUBLIC_*` values that step sees.

## Which Tests to Run (Decision Tree)

See AGENTS.md §5 "Which tests to run" — canonical, don't duplicate here.

## The Golden Rule: Worker Isolation

PinPoint E2E tests run in parallel against a **shared database**.

**YOU MUST PREVENT CROSSTALK.**

1.  **Unique Data**: Never assume the DB is empty. Always create your own unique data.
2.  **Unique Users**: Do not share `admin@test.com` across parallel tests if those tests modify global state (e.g., settings, notifications).
3.  **Unique Machines**: Create a fresh machine for your test.
4.  **Unique Titles**: Use `getTestIssueTitle("My Title")` to prefix issues with `[w0_xyz]`.

### Cross-project failures

Running without `--project=chromium` runs every browser project concurrently against one database, so a spec that mutates a seeded row and never restores it passes in whichever project is scheduled first and fails in the rest. **Read that red as a real bug, not a local-setup artifact.** PP-168u was ten such failures and every one traced to a spec leaking seeded state — a seeded issue reassigned away for good, the seeded guest left promoted to member, a settings set left on a shared machine.

The three required PR E2E jobs each run a single project against their own database and so cannot see this class at all; the only job that can is the post-merge `E2E Comprehensive` matrix, whose legs each run chromium + Mobile Chrome + Mobile Safari in **one** Playwright process against **one** database for a set of spec files (`scripts/workflow/e2e-shard-files.py` shards by file so all three browsers of a spec share a leg; a leak that crosses into a spec file on another leg is not caught). It is push-to-main only, so it cannot gate a PR merge — but its `failure` fails the required `CI Gate` check **on the main commit it ran for** (PP-x0ke; main runs one at a time and each run tests every change since the last passing main commit), so a red post-merge full-matrix verdict alarms at merge time instead of hiding behind a green main. On a `pull_request` event it is skipped and passes.

## Selector Strategy

1. **Prefer**: Accessibility roles and labels (`getByRole`, `getByLabel`)
2. **Fallback**: Test IDs (`data-testid`) when roles aren't sufficient
3. **Avoid**: CSS selectors, text content that changes

## Common Helpers

- **Select Reset Assertions**: Use `assertSelectAtPlaceholder(trigger, placeholderText)` for placeholder state, or `assertSelectValue(trigger, expectedLabel)` for default value state (e.g. `await assertSelectValue(page.getByTestId("select-id"), "Minor")`).
- **Accessibility scan**: `assertNoA11yViolations(page)` — see "Accessibility Checks (axe-core)" below.

## Accessibility Checks (axe-core)

`assertNoA11yViolations(page, options?)` in `e2e/support/actions.ts` is the E2E suite's real accessibility mechanism: a genuine `@axe-core/playwright` scan. A passing `getByLabel()` only proves one accessible name resolved, whereas this helper catches whole classes an accessible-name check cannot — color contrast, ARIA misuse, and table semantics among them. It is the dynamic backstop to the CORE-A11Y-001..006 accessibility floor (`docs/NON_NEGOTIABLES.md`), not a replacement for it: the floor's static rules (skip link, `motion-reduce:` pairing, real `<button>`s) still need their own review — see `pinpoint-ui` references/accessibility.md.

**Signature:** `assertNoA11yViolations(page: Page, options?: { ignore?: string[] }): Promise<void>`

**What it does:**

- Runs `new AxeBuilder({ page }).analyze()` against the page's **current rendered state**, so call it _after_ you have navigated and the surface you want to check has settled (await your usual load/visibility assertions first).
- **Fails the test only on `serious` and `critical` impact violations** — it throws with a per-violation report (rule id, help URL, offending selectors + HTML).
- **`minor`/`moderate` (and un-ranked) violations do not fail** — they are logged to the console (up to 5, with up to 3 elements each). Watch for `[A11y Warning]` lines; they are real findings the gate deliberately does not block on.
- Attaches the full scan to the Playwright report as `a11y-scan-results.json` when run inside a test.

**Always-disabled rules** (hard-coded, with reasons in the source): `aria-prohibited-attr` (Tiptap `contenteditable` editor), `nested-interactive` (Radix/shadcn accordion + collapsible triggers), and `scrollable-region-focusable` (the skip-to-main `tabindex="-1"` content container). `options.ignore` adds further rule ids to disable (deduped with the defaults) — reach for it only to suppress a framework-level false positive you have confirmed, never to hide a real app violation.

**When to call it:** when you are already writing a smoke spec for a page-level or redesigned-UI surface, add a scan on its primary rendered state — after the content is visible (an opened modal/menu counts). Don't spin up a new spec just to host a scan; fold it into the journey you're already testing (see the pre-flight checklist above). It is currently used across the `e2e/smoke/` specs as the bare `assertNoA11yViolations(page)` — no caller passes `ignore`. To re-derive real usage rather than trust a frozen count, `rg -c 'assertNoA11yViolations\(page' e2e/smoke/` (at this writing: 26 calls across 14 smoke specs), and `rg 'assertNoA11yViolations\(page, \{' e2e/` to find any `ignore` overrides.

## References

- **Best Practices**: See [references/e2e-best-practices.md](references/e2e-best-practices.md) for structure and anti-patterns.
- **Isolation Patterns**: See [references/isolation-patterns.md](references/isolation-patterns.md) for how to use `test-isolation.ts` and `supabase-admin.ts`.
- **Helpers**: See [references/common-helpers.md](references/common-helpers.md) for `actions.ts`, `page-helpers.ts`, and `mailpit.ts`.

## Sandbox & Playwright (macOS only — does not apply on the Bazzite Linux host)

- The macOS sandbox blocks Chromium's Mach port IPC, causing `MachPortRendezvousServer: Permission denied` crashes.
- Playwright commands are excluded from sandboxing via `excludedCommands` in `.claude/settings.local.json`. If you see Mach port errors, verify the command prefix matches an entry there (env var prefixes like `SKIP_SUPABASE_RESET=true` need separate entries).

## Debugging Checklist

If a test fails in CI or parallel mode:

1.  **Crosstalk?**: Is it seeing data from another worker? (Check screenshots for other prefixes).
    - _Fix_: Use `getTestPrefix()` filtering and unique resources.
2.  **Session Lost?**: Redirecting to `/report/success` or `/login` unexpectedly?
    - _Fix_: Ensure `x-skip-autologin` is NOT interfering. Add `test.use({ storageState: STORAGE_STATE.<role> })` to the describe block, or use `loginAs` for mid-test role switches. Check `test.describe.serial` if tests share a user.
3.  **Timeout?**: Waiting for a toast or email?
    - _Fix_: Use `waitForLoadState("networkidle")` before assertions. Increase timeouts for emails.
4.  **Mobile layout different?**: Nav links not visible on mobile?
    - _Fix_: AppHeader is unified — same `data-testid="app-header"` on all viewports. Nav links hide below `md:`, BottomTabBar handles mobile navigation. Use `testInfo.project.name.includes("Mobile")` only when testing layout-specific behavior (e.g., checking BottomTabBar visibility).

## Authentication Strategy

**Decision tree for new tests:**

| Test type                                   | Auth approach                                      |
| :------------------------------------------ | :------------------------------------------------- |
| Tests one role throughout                   | `test.use({ storageState: STORAGE_STATE.<role> })` |
| Switches roles mid-test                     | `loginAs(page, testInfo, { email, password })`     |
| Tests login/signup/password reset           | No auth — start unauthenticated                    |
| Tests public routes                         | No auth — omit `test.use()`                        |
| Dynamic user (created via `createTestUser`) | `loginAs` after creating the user                  |

**Available roles:**

```typescript
import { STORAGE_STATE } from "../support/auth-state"; // adjust path to e2e root

// STORAGE_STATE.admin      → admin@test.com
// STORAGE_STATE.member     → member@test.com
// STORAGE_STATE.technician → technician@test.com
```

No auth needed for unauthenticated tests — simply omit `test.use()`.

## Creating a New Test

1.  **Scaffold** (single-role — preferred):

    ```typescript
    import { test, expect } from "@playwright/test";
    import { STORAGE_STATE } from "../support/auth-state";
    import { getTestIssueTitle } from "../support/test-isolation";

    test.describe("My Feature", () => {
      test.use({ storageState: STORAGE_STATE.member });

      test("my feature works", async ({ page }) => {
        const title = getTestIssueTitle("Feature Test");
        await page.goto("/dashboard");
        // ...
      });
    });
    ```

2.  **Scaffold** (multi-role or auth flow — use loginAs):

    ```typescript
    import { test, expect } from "@playwright/test";
    import { loginAs } from "../support/actions";

    test("role-switch works", async ({ page }, testInfo) => {
      await loginAs(page, testInfo); // logs in as member
      // ... do member actions
    });
    ```

3.  **Isolate**: If modifying global state, create a temp user/machine in `beforeAll`.
4.  **Cleanup**: Delete created resources in `afterAll`.
