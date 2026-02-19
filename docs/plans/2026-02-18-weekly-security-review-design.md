# Weekly Security Review Agent — Design

**Date:** 2026-02-18
**Scope:** Automated weekly gh-aw workflow that reviews the past 8 days of merged changes for security, privacy, and data safety issues, then opens a GitHub Issue with findings.

## Context

PinPoint already has automated security tooling in CI (Gitleaks for secrets, pnpm audit for dependency CVEs, TypeScript strict mode). These catch mechanical issues but not semantic ones — like a new Server Action missing an auth check, or user emails leaking into a Client Component.

This workflow fills that gap: a weekly AI-driven code review focused on security and privacy.

## Workflow Mechanics

- **File**: `.github/workflows/weekly-security-review.md` (compiled to `.lock.yml`)
- **Schedule**: Weekly on Monday (`0 14 * * 1` UTC / 8 AM CST)
- **Manual trigger**: `workflow_dispatch` for on-demand runs
- **Engine**: `copilot` (reuses existing `COPILOT_GITHUB_TOKEN`)
- **Permissions**: `contents: read`, `pull-requests: read` (read-only sandbox)
- **Safe-output**: `create-issue` — agent signals intent, gh-aw creates the issue

## Agent Strategy

### Phase 1: Gather Context

1. List merged PRs from the last 8 days via `gh pr list`
2. Read `docs/NON_NEGOTIABLES.md` from the repo to load current security rules
3. For each PR, read the diff to understand what changed

### Phase 2: Review

Two layers of analysis:

**Structured**: Walk through the non-negotiables against the week's changes. For each rule, determine whether it was violated, passing, or not applicable.

**Instinct-driven**: Beyond the checklist, the agent thinks like an attacker — flagging new attack surfaces, data flow concerns, missing edge cases, logic that could be exploited. The agent is not constrained to only the non-negotiables.

### Phase 3: Report

Create a GitHub Issue via the `create_issue` tool. Always creates an issue, even for clean weeks (confirms the workflow ran).

## Issue Output Format

```markdown
## Weekly Security Review: <start date> – <end date>

**PRs reviewed**: #1015, #1016, #1017
**Verdict**: <one-line summary>

### Non-Negotiable Checklist

- Status emoji + brief note per relevant rule
- N/A rules explicitly marked

### Broader Analysis

Free-form observations — new attack surfaces, data flow concerns,
anything that doesn't fit a checkbox

### Recommendations

Prioritized next steps, if any
```

The agent decides how much to write per section. Quiet weeks are short. Weeks with auth or data changes get deeper analysis.

## Design Decisions

| Decision      | Choice                                  | Rationale                                              |
| ------------- | --------------------------------------- | ------------------------------------------------------ |
| Output format | GitHub Issue                            | Trackable, assignable, fits existing workflow          |
| Rules source  | Read `NON_NEGOTIABLES.md` at runtime    | Single source of truth, no drift                       |
| Agent freedom | Checklist backbone + free-form analysis | Structured but not overconstrained                     |
| Clean weeks   | Always create issue                     | Heartbeat confirms workflow ran                        |
| Engine        | Copilot                                 | Token already configured, proven in changelog workflow |
| Schedule      | Monday 8 AM CST                         | Same cadence as changelog, reviews full prior week     |
