---
description: Automated PR review workflow with worktree isolation, rebase, and UI verification.
---

# PR Review Workflow

Automates the process of checking out, updating, and reviewing a Pull Request.

## Prerequisites

- [ ] GitHub CLI (`gh`) installed and authenticated.
- [ ] `bd` (beads) CLI installed.
- [ ] `pnpm` installed.
- [ ] `./pinpoint-wt` script available in repo root.

## Phase 1: Environment Setup

1.  **Fetch & Sync**:

    ```bash
    git fetch origin main
    ```

2.  **Worktree Management**:
    - Check if a worktree already exists for the PR branch:
      ```bash
      git worktree list | grep <branch_name>
      ```
    - If it exists, `cd` into that directory.
    - If it DOES NOT exist, create it:
      ```bash
      ./pinpoint-wt create <branch_name>
      cd ../pinpoint-worktrees/<branch_name>
      ```

3.  **Update Branch**:
    ```bash
    git rebase origin/main
    ```

## Phase 2: Context & Quality

1.  **Identify Issue**:
    - View PR details to find the linked bead (e.g., `Closes PinPoint-XXX`):
      ```bash
      gh pr view <PR_NUMBER>
      ```
    - Get bead context:
      ```bash
      bd show <ISSUE_ID>
      ```

2.  **Static Analysis**:
    - Run quality gates in the worktree:
      ```bash
      pnpm run check
      ```

## Phase 3: UI Verification

1.  **Start Services**:
    - Run migrations/reset if needed (check `supabase/migrations` diff):
      ```bash
      supabase start
      # If migrations changed:
      pnpm run db:reset
      ```
    - Start dev server:
      ```bash
      pnpm dev
      ```

2.  **Manual Testing**:
    - Use `browser_subagent` to navigate to the app.
    - Verify user flows described in the bead and the PR test plan.
    - **Capture screenshots** for the report.

## Phase 4: Reporting

1.  **Generate Report**:
    - Write a detailed report to `artifacts/reviews/PR_<PR_NUMBER>.md` in the MAIN workspace (not the worktree).
    - Use the template from `artifacts/reviews/template.md`.
    - Include bead summary, code changes, issues found, and manual test results with screenshots.

## Phase 5: Cleanup

1.  **Stop Dev Server**:
    - Terminate the `pnpm dev` process (use PID or stop command).
2.  **Stop Supabase**:
    ```bash
    supabase stop
    ```
