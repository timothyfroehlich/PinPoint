# Weekly Security Review Agent — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a gh-aw workflow that runs every Monday, reviews the past 8 days of merged PRs for security/privacy issues, and opens a GitHub Issue with findings.

**Architecture:** Single gh-aw workflow (`.md` source compiled to `.lock.yml`). Agent reads `docs/NON_NEGOTIABLES.md` at runtime for security rules, scans PR diffs, and creates an issue via the `create_issue` safe-output. Modeled on the existing `weekly-changelog.md` workflow.

**Tech Stack:** gh-aw (GitHub Agent Workflows), Copilot engine, gh CLI

**Design doc:** `docs/plans/2026-02-18-weekly-security-review-design.md`

---

### Task 1: Write the workflow source file

**Files:**

- Create: `.github/workflows/weekly-security-review.md`

**Step 1: Create the workflow file**

Write `.github/workflows/weekly-security-review.md` with this exact content:

```markdown
---
description: |
  Weekly security and privacy review of merged changes.
  Creates a GitHub Issue with findings.

on:
  schedule: weekly on monday
  workflow_dispatch:

permissions:
  contents: read
  pull-requests: read

engine: copilot

safe-outputs:
  create-issue:
    title-prefix: "Weekly Security Review: "
---

# Weekly Security Review Agent

You are a security reviewer for PinPoint, a pinball machine issue tracker built with Next.js, Drizzle ORM, and Supabase. Your job is to review the past week's code changes for security, privacy, and data safety issues.

## Setup

First, read the project's security rules:
```

cat docs/NON_NEGOTIABLES.md

```

This file contains the project's non-negotiable rules organized by category. Pay special attention to:
- **CORE-SEC-001 through CORE-SEC-007** — Security rules (auth checks, input validation, CSP, email privacy, data minimization)
- **CORE-SSR-001 through CORE-SSR-007** — Auth and SSR rules (Supabase patterns, session handling)
- **Forbidden Patterns** — Explicit list of banned practices

## Instructions

1. **List merged PRs** from the past 8 days:

```

gh pr list --state merged --base main --search "merged:>=$(date -d '8 days ago' +%Y-%m-%d)" --limit 50 --json number,title,mergedAt,body

```

2. **For each PR with code changes**, read the diff:

```

gh pr diff <number>

```

Skip PRs that are documentation-only or dependency bumps — focus on PRs that touch application code (`src/`), database migrations (`supabase/`), middleware, or configuration.

3. **Check against Non-Negotiables**: For each relevant rule in NON_NEGOTIABLES.md, determine if the week's changes introduced a violation:
- ✅ Passing — changes comply with this rule
- ❌ Violated — describe the specific violation and which PR introduced it
- ⬜ Not applicable — no changes touched this area this week

4. **Broader security analysis**: Beyond the checklist, use your judgment. Think like an attacker:
- Are there new attack surfaces (new endpoints, new forms, new API routes)?
- Could any data flow expose user information to unauthorized viewers?
- Are there edge cases or race conditions that could be exploited?
- Do new dependencies introduce supply chain risk?
- Were any security-relevant tests removed or weakened?

5. **Create an issue** using the `create_issue` tool. Use a title formatted as the date range, e.g. `Feb 10 – Feb 17, 2026` (the configured prefix will be prepended automatically).

Structure the issue body as:

```

**PRs reviewed**: #101, #102, #103
**Verdict**: [one-line summary — "All clear" or "N findings need attention"]

## Non-Negotiable Checklist

[For each relevant rule: status emoji, rule ID, and brief note]

## Broader Analysis

[Free-form observations — new attack surfaces, data flow concerns, anything notable]

## Recommendations

[Prioritized next steps, if any. Reference specific PRs and files.]

```

6. **Always create an issue**, even if no concerns are found. A clean report confirms the review ran successfully. For clean weeks, keep it brief: list the PRs reviewed, confirm all non-negotiable checks passed, and note any positive security practices observed.
```

**Step 2: Verify the file was created correctly**

Run: `head -5 .github/workflows/weekly-security-review.md`
Expected: The YAML frontmatter starting with `---` and `description:`

---

### Task 2: Compile the workflow

**Files:**

- Generated: `.github/workflows/weekly-security-review.lock.yml`
- May update: `.github/aw/actions-lock.json`

**Step 1: Compile the workflow**

Run: `gh aw compile`
Expected: Success message indicating the `.lock.yml` was generated.

**Step 2: Verify the lock file exists**

Run: `ls -la .github/workflows/weekly-security-review.lock.yml`
Expected: File exists, roughly 40-60KB (similar to the changelog lock file).

**Step 3: Verify it passes YAML lint**

The `.yamllint.yml` already ignores `*.lock.yml` files (added during the changelog workflow work), so no changes needed here. Confirm:

Run: `grep 'lock.yml' .yamllint.yml`
Expected: Line showing the ignore pattern for lock files.

---

### Task 3: Commit and push

**Step 1: Stage the new files**

```bash
git add .github/workflows/weekly-security-review.md .github/workflows/weekly-security-review.lock.yml .github/aw/actions-lock.json
```

**Step 2: Commit**

```bash
git commit -m "feat: add weekly security review gh-aw workflow

Automated Monday workflow that reviews merged PRs for security,
privacy, and data safety issues against NON_NEGOTIABLES.md rules.
Creates a GitHub Issue with findings."
```

**Step 3: Push**

```bash
git push -u origin feat/weekly-security-review
```

---

### Task 4: Test with manual dispatch

**Important:** `workflow_dispatch` only works from the default branch (main) for gh-aw workflows. To test before merging, either:

- **Option A**: Merge to main first, then run `gh workflow run weekly-security-review`
- **Option B**: Add a temporary `push` trigger (like we did for the changelog workflow), test, then remove it before final merge

**If using Option B (recommended for pre-merge testing):**

**Step 1: Add temporary push trigger**

Add to the frontmatter `on:` section:

```yaml
on:
  push:
    branches: [feat/weekly-security-review]
    paths: [".github/workflows/weekly-security-review.*"]
  schedule: weekly on monday
  workflow_dispatch:
```

**Step 2: Recompile and push**

```bash
gh aw compile
git add .github/workflows/weekly-security-review.*
git commit -m "test: add temporary push trigger for security review workflow"
git push
```

**Step 3: Watch the workflow run**

```bash
gh run list --workflow=weekly-security-review.lock.yml --limit 1
gh run watch <run-id>
```

**Step 4: Verify the issue was created**

```bash
gh issue list --search "Weekly Security Review" --limit 1
gh issue view <issue-number>
```

Review the issue: Does it follow the expected format? Did the agent read NON_NEGOTIABLES.md? Are the PR references correct?

**Step 5: Remove temporary push trigger**

Revert the frontmatter to only `schedule` + `workflow_dispatch`, recompile, commit, and push.

---

### Task 5: Open PR

**Step 1: Create PR**

```bash
gh pr create --title "feat: add weekly security review workflow" --body "## Summary

- Adds a gh-aw workflow that runs every Monday
- Reviews the past 8 days of merged PRs for security/privacy issues
- Creates a GitHub Issue with structured findings (non-negotiable checklist + broader analysis)
- Always creates an issue, even for clean weeks (heartbeat confirmation)

Modeled on the weekly-changelog workflow (#1012).

## Design doc

docs/plans/2026-02-18-weekly-security-review-design.md

## Test plan

- [ ] Workflow compiles with \`gh aw compile\`
- [ ] Manual dispatch creates a well-formatted issue
- [ ] Agent reads NON_NEGOTIABLES.md at runtime
- [ ] Issue references correct PRs from the past week
- [ ] CI passes"
```

**Step 2: Monitor CI**

```bash
gh pr checks <pr-number> --watch
```
