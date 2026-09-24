# PinPoint — Code Review Brief

This is the canonical review rubric for PinPoint. It is harness-neutral: Claude Code reads it via a pointer in `CLAUDE.md` (and via the `/code-review` skill), and `AGENTS.md` points reviewers here. Any reviewer reads the same brief — edit only here.

PinPoint is a **single-tenant** pinball issue tracker (Austin Pinball Collective), in live production with real user data. Stack: Next.js App Router (React Server Components by default), Drizzle ORM on Supabase Postgres, Supabase SSR auth, shadcn/ui + Tailwind CSS v4, TypeScript `ts-strictest`. There is no multi-tenancy, no RLS, and no tRPC — by design.

Cite the `CORE-*` rule ID (e.g. `CORE-SEC-007`) in a review comment when a change violates a rule below, so the author can look it up.

## Highest priority — each of these has shipped a real bug

- **Email privacy (CORE-SEC-007).** A user's email address must never appear outside `/admin/*` views and the user's own settings page. Flag any UI, timeline event, notification body, seed fixture, or prop passed to a client component that renders `reporterEmail` or a raw email elsewhere. The correct display chain is `reportedByUser.name` → `invitedReporter.name` → `reporterName` → `"Anonymous"`.
- **Permissions through the matrix (CORE-ARCH-008).** Every authorization check must go through `checkPermission()` from `~/lib/permissions/helpers`, or a centralized resource predicate in `src/lib/permissions/` for multi-dimensional entity state (collaborators, tokens, compound ownership) that delegates its role dimension to `checkPermission()`. Flag any standalone permission check defined outside `src/lib/permissions/` or any hardcoded role comparison used as an authorization gate. If a PR changes a server action's or loader's auth logic, verify `src/lib/permissions/matrix.ts` still agrees; if it changes the matrix, verify the server action enforces it.
- **No side effects inside DB transactions (CORE-ARCH-011).** Flag any HTTP request, email/Discord send, blob upload, or Vault RPC inside a `db.transaction(...)` callback. Inputs are fetched before the transaction; effects are delivered after commit via `after()` + `planNotification`/`dispatchNotification`.

## Type safety (CORE-TS-007, CORE-TS-008)

- Flag `any` (explicit or implicit), non-null assertions (`!`), and unsafe `as` casts. Require narrowing with type guards instead.
- Flag deep relative imports (`../../..`); imports use the `~/` path alias.

## Architecture

- **Server-first (CORE-ARCH-001).** Flag `"use client"` on a component with no interactivity (no event handlers, browser APIs, or client state). Server Components are the default.
- **Minimal client payload (CORE-SEC-006).** Flag a `"use client"` component that receives a whole ORM row or domain object as a prop; the server→client boundary should pass only the fields the component uses. The RSC payload is visible in page source.
- **Migrations only (CORE-ARCH-009).** Schema changes go through `db:generate` + `db:migrate`. Flag any `drizzle-kit push` or Supabase-migration usage. Every new `.sql` migration must have a matching `_snapshot.json`.

## Single-tenant & environment

- Flag any newly introduced org scoping, multi-tenant context wrapper, RLS policy, pgTAP test, or tRPC router — the app has none and should stay that way.
- **`localhost`, never `127.0.0.1` (CORE-SEC-008).** Flag `127.0.0.1` in `supabase/config.toml`, `.env*`, Playwright config, or scripts — browser cookie isolation breaks Supabase SSR auth across the two hosts.

## Spec conformance

Some features have a living requirements spec in `docs/feature-specs/` (see the `spec-driven-development` skill). When a PR touches behavior covered by one:

- **Review the code against the spec.** Cite requirement numbers (`spec §4.6`) the way you cite `CORE-*` IDs. A behavior change the spec doesn't sanction needs either a same-PR spec update or a new row in the spec's Known-divergences table — flag it if it has neither.
- **If the PR edits the spec itself**, additionally review the divergence table both ways: are existing rows now stale given the spec change, and does the code diverge anywhere the table doesn't yet record?

Divergence rows are a one-line todo list, not writeups.

## Help-page accuracy

If a PR changes roles, statuses, permissions, or user-facing terminology, check `src/app/(app)/help/` for content that becomes stale. Role names must match `src/lib/permissions/matrix.ts` (Guest, Member, Technician, Admin). Status labels must use the display labels in `STATUS_CONFIG` (`src/lib/issues/status.ts`), not raw database values.

## Scope of the review

A default `/code-review` pass is aimed at smaller changes — Tim triggers deeper reviews (`/code-review ultra`) manually on bigger ones. In practice: prioritise the highest-priority rule violations above and genuine correctness defects. Don't editorialise about style a formatter or linter already owns (Prettier, oxlint). A clean review — no comments — is a valid outcome; don't manufacture nits to justify the pass.

## Reviewer-relevant skill pointers

Reviewers read agent skills. Consult the relevant one for the area a PR touches — this is a routing table, not a summary; read the skill itself for the actual guidance. All live at `.agents/skills/<name>/SKILL.md`.

- `pinpoint-security` — CSP authoring, redirects and site-URL construction, the `@supabase/ssr` allowlist, sanitizers, and what counts as a non-gating role comparison. The rules themselves are `CORE-SEC-*` / `CORE-SSR-*`.
- `pinpoint-testing` — whether a PR picked the right test layer (unit/integration/E2E) for what it's testing.
- `pinpoint-e2e` — Playwright/E2E stability: worker isolation, flake-prone patterns.
- `pinpoint-typescript` — the db→app typing decision: no converter layer, narrow with `Pick<>` at boundaries. CORE-TS-007's unsafe-`as` third is not linted, so a cast between two known types stays a review question.
- `pinpoint-ui` and `pinpoint-design-bible` — UI, component, and responsive-design changes. `pinpoint-ui` also owns Server Actions, data fetching, and the form conventions (Radix Select form-reset carve-out, CREATE form reset).
- `pinpoint-deployment` — Drizzle migrations, DB connection/pooler config, preview deployments.

## How review runs

**CodeRabbit is the default automated reviewer.** PRs are opened as drafts; promoting a PR out of draft (`gh pr ready <PR>`) automatically triggers a CodeRabbit review on that commit head. Subsequent commits do not automatically trigger re-reviews; re-evaluating an updated head requires `bash scripts/workflow/request-coderabbit-review.sh <PR>`. CodeRabbit has an hourly quota of 5 reviews per rolling hour. If draft promotion is rate-limited, make one SHA-tagged manual CodeRabbit request on that same head. A trusted `Review rate limited` reply to a SHA-tagged current-head request permits the manual Codex fallback: `bash scripts/workflow/request-codex-review.sh <PR> <CodeRabbit-reply-comment-ID>`. A missing approval or completed review without native or trusted incremental summary coverage is not a quota signal; follow up with CodeRabbit. If Codex is also out of quota or unavailable, the author alerts Tim and recommends either performing a local review attestation or waiting until the next CodeRabbit review slot becomes available.

A PR cannot merge without a review covering its **current head commit**, with every thread resolved. Review priority follows the hierarchy: **CodeRabbit $\longrightarrow$ Codex $\longrightarrow$ Local Attestation**. A native `APPROVED` review from exact account `coderabbitai[bot]` pinned to head satisfies coverage. An exact-head CodeRabbit finding review satisfies coverage when its stated actionable count matches inline comments and each maps to a resolved thread with an owner reply or a later change to its commented file; body-only and silently resolved findings remain blocked. After a prior native approval or adjudicated finding review, its trusted exact-head incremental summary satisfies coverage; Codex may provide a native `APPROVED` review, its trusted connector clean comment, a trusted GitHub Actions witness that pins a fresh Codex `eyes`→`+1` transition to head, or a native `COMMENTED`/`CHANGES_REQUESTED` review whose finding threads have all been explicitly adjudicated and resolved. Direct reactions are never merge evidence because GitHub does not attach a commit SHA to them. Codex records must be from exact account `chatgpt-codex-connector[bot]`; clean connector comments must also identify the connector app, while reaction witnesses must be from exact account `github-actions[bot]` and app `github-actions`. The existing SHA-pinned manual attestation may cover head after Tim explicitly runs a local review. The gate runs these as three independent checkers (CodeRabbit, Codex, local attestation) and passes when any one covers head; a CodeRabbit `CHANGES_REQUESTED` on head reads as `changes requested` while finding threads remain unresolved and never masks another reviewer's coverage. Any push requires a fresh review. **If you're reviewing, assume the commit you were handed is the one the author intends to be final.** Full author-side rules: `.agents/skills/pinpoint-pr-workflow/SKILL.md` Phase 3.4.

## Review mechanics

Sign every review comment or reply with your agent name (`—Claude`, `—Gemini`, `—Codex`, `—Antigravity`). If you decline to act on a comment (Tim's or another agent's), don't leave it silent: reply with one sentence explaining why, then resolve the thread. Every comment gets a fix or a reply — never a silent ignore.

## The PinPoint merge boundary

Reviewers never merge a PinPoint PR merely by reviewing it. Tim decides whether to merge (PP-wi85). An owning agent may run the gate-enforced `bash scripts/workflow/merge-pr.sh <PR> --human` only after his explicit request in the active task; “merge it” counts when the target PR is unambiguous. The script rechecks CI, exact-head review, threads, and conflicts. Raw channels (`gh pr merge`, `gh api PUT .../merge`, MCP `merge_pull_request`) remain off-limits to agents because they skip those gates.

Claude Code and Codex load the `block-direct-merge.cjs` hook, which may add an approval prompt before the guarded script runs. Tim’s explicit request in the task authorizes the agent in any harness to pass `--human`; that additional prompt is not a reason to refuse or ask him to type a command. Antigravity and Gemini may not have this hook. If the target is ambiguous, clarify it first. If any gate fails, stop and report it; bypass flags need separate explicit authorization.

Without an explicit merge request, hand off a GitHub-ready PR with CI green, exact-head review coverage, zero unresolved threads, the `ready-for-review` label, and screenshots or the no-visual-change marker as required. When Tim explicitly requests the merge, run the guarded script in any harness and verify the result.

## Pointers, not copies

- `docs/NON_NEGOTIABLES.md` is the full `CORE-*` catalog — severity, rationale, do/don't for every rule cited above. It stays there; this brief only cites IDs.
