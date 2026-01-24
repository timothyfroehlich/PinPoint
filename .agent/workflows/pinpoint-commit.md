---
description: Comprehensive commit-to-PR workflow with testing, branch management, and CI monitoring
---

# PinPoint Commit Workflow

A comprehensive workflow that handles the entire commit lifecycle: from checking files → running tests → creating branches → pushing → creating PRs → monitoring CI.

## Phase 1: Pre-Commit Checks

### 1.1 Check Git Status

Run `git status --porcelain` and analyze:

- **Staged files** (prefix `A`, `M`, `D`, etc.)
- **Unstaged files** (second column)
- **Untracked files** (prefix `??`)

### 1.2 Review with User

Present a summary:

```
📦 Files ready to commit (staged):
  - src/components/IssueList.tsx
  - src/lib/api/issues.ts

⚠️  Unstaged changes (not included):
  - src/server/db/schema.ts

❓ Untracked files:
  - debug.log
```

**Ask the user**:

1. "Do you want to include any of the unstaged files?"
2. "Should I ignore any untracked files (add to .gitignore)?"
3. "Are there any files that shouldn't be committed?"

**Actions**:

- Run `git add <files>` for any additional files user wants to include
- Update `.gitignore` if requested
- Run `git reset <files>` for any files to exclude

### 1.3 Validate Current State

Check for common issues:

- ✅ No merge conflicts (`git diff --check`)
- ✅ Not committing sensitive files (`.env`, secrets, etc.)
- ✅ Not committing debug/temp files (`*.log`, `.DS_Store`, etc.)

If issues found, alert user and offer to fix.

---

## Phase 2: Testing & Validation

### 2.1 Run Preflight

// turbo
Execute: `pnpm run preflight`

This runs:

- `typecheck` - TypeScript compilation
- `lint:fix` - ESLint with auto-fix
- `format:fix` - Prettier formatting
- `test` - Unit tests
- `check:config` - Config validation
- `db:fast-reset` - Clean DB state
- `build` - Production build
- `test:integration` - Integration tests
- `test:integration:supabase` - Supabase integration tests
- `smoke` - Smoke E2E tests (Chromium + Mobile Chrome)

**If preflight fails**:

1. Show the error
2. Offer to auto-fix if it's a linting/formatting issue: `pnpm run lint:fix && pnpm run format:fix`
3. If tests fail, ask user if they want to:
   - Fix manually and re-run
   - Skip tests (NOT recommended, explain risks)
   - Abort commit

### 2.2 Intelligent E2E Test Selection

Analyze changed files to determine if full E2E suite is needed:

**Decision Matrix**:

| File Pattern            | Recommended Test Suite | Reasoning                                   |
| ----------------------- | ---------------------- | ------------------------------------------- |
| `src/app/**/page.tsx`   | `e2e:full`             | Page-level changes affect user journeys     |
| `src/components/ui/*`   | `e2e:full`             | UI component changes may break interactions |
| `src/server/actions/*`  | `e2e:full`             | Server actions are critical paths           |
| `middleware.ts`         | `e2e:full`             | Middleware affects all routes               |
| `src/lib/auth/*`        | `e2e:full`             | Auth changes are high-risk                  |
| `supabase/migrations/*` | `smoke` only           | Migrations tested in preflight              |
| `src/lib/utils/*`       | `smoke` only           | Utilities covered by unit tests             |
| `*.test.ts`             | `smoke` only           | Test files don't need E2E                   |
| `docs/*`, `*.md`        | Skip E2E               | Documentation only                          |

**Ask the user**:

```
Based on your changes to:
  - src/app/(app)/issues/page.tsx
  - src/components/IssueList.tsx

I recommend running: pnpm run e2e:full (full E2E suite)
This will add ~3-5 minutes but ensures user journeys work end-to-end.

Options:
1. Run full E2E suite (recommended)
2. Skip E2E (rely on smoke tests from preflight)
3. Run specific suite (e2e:mobile for mobile-only changes)
```

**If user approves E2E**:
// turbo

- Run the selected test suite
- If tests fail, offer to show failure details and abort/continue

---

## Phase 3: Branch Management

### 3.1 Check Current Branch

Run `git rev-parse --abbrev-ref HEAD`

**Branch Validation Rules**:

- ✅ **Feature branches**: `feature/*`, `fix/*`, `chore/*`, `docs/*`
- ⚠️ **Main branch**: Should NOT commit directly to main
- ❌ **Detached HEAD**: Must create a branch

### 3.2 Handle Branch Scenarios

#### Scenario A: On `main` branch

```
⚠️  You're on the main branch!
PinPoint policy: Work on feature branches, not main.

I'll create a new branch for you.
```

→ Jump to **3.3 Create New Branch**

#### Scenario B: Detached HEAD

```
❌ You're in detached HEAD state.
I need to create a branch to commit your changes.
```

→ Jump to **3.3 Create New Branch**

#### Scenario C: On a valid feature branch

```
✅ You're on branch: feature/issue-filter-search
This is a valid feature branch. Proceeding...
```

→ Continue to **Phase 4**

### 3.3 Create New Branch

**Generate branch name suggestion**:

1. Analyze changed files to infer purpose
2. Suggest conventional branch name

**Examples**:

```
Changed files: src/components/IssueList.tsx, src/lib/filters.ts
→ Suggest: feature/issue-list-filters

Changed files: src/server/actions/auth.ts
→ Suggest: fix/auth-validation

Changed files: docs/API.md
→ Suggest: docs/api-documentation
```

**Ask the user**:

```
I'll create a new branch off main.
Suggested name: feature/issue-list-filters

Options:
1. Use suggested name
2. Enter custom name
3. Enter GitHub issue number (I'll format as "feature/123-description")
```

**Create branch**:

```bash
git checkout -b <branch-name> main
```

---

## Phase 4: Commit Message

### 4.1 Generate Commit Message

**Use Conventional Commits format**: `<type>(<scope>): <description>`

**Types**:

- `feat`: New feature
- `fix`: Bug fix
- `chore`: Maintenance (deps, config, etc.)
- `docs`: Documentation
- `refactor`: Code refactoring
- `test`: Test changes
- `perf`: Performance improvement
- `style`: Code style changes (formatting)

**Analyze changes to suggest**:

```
Changed files:
  - src/app/(app)/issues/page.tsx
  - src/components/IssueList.tsx
  - src/lib/filters.ts

Suggested commit:
  Type: feat
  Scope: issues
  Message: feat(issues): Add advanced filtering to issue list

  Body:
  - Implement multi-select filters for status, priority, assignee
  - Add date range picker for created/modified filters
  - Refactor IssueList to use new filter components
```

### 4.2 Ask User for Input

**Prompt**:

```
I've drafted a commit message:

  feat(issues): Add advanced filtering to issue list

  - Implement multi-select filters for status, priority, assignee
  - Add date range picker for created/modified filters
  - Refactor IssueList to use new filter components

Options:
1. Use this message
2. Edit the message
3. Add "Closes #" reference (if there's a related issue)
```

**If user wants to add issue reference**:

- Check if `gh` CLI is available
- Run `gh issue list --limit 20 --json number,title`
- Show recent issues for user to select
- Append `Closes #<issue>` to commit body

### 4.3 Commit

```bash
git commit -m "<title>" -m "<body>"
```

---

## Phase 5: Push & PR Management

### 5.1 Check Upstream Status

Run `git rev-parse --abbrev-ref @{upstream}` to check if remote branch exists.

**If remote branch doesn't exist**:

```bash
git push -u origin <branch-name>
```

**If remote branch exists**:
Check sync status:

```bash
git rev-list --left-right --count HEAD...@{upstream}
```

**If local is behind remote**:

```
⚠️  Your branch is behind origin/<branch-name>.
You may want to pull first to avoid conflicts.

Options:
1. Pull and rebase (git pull --rebase)
2. Force push (⚠️  only if you know what you're doing)
3. Abort
```

**If local is ahead**:

```bash
git push
```

### 5.2 Check for Existing PR

Run `gh pr list --head <branch-name> --json number,url,state`

**If PR exists**:

```
✅ Found existing PR #123
URL: https://github.com/timothyfroehlich/PinPoint/pull/123

Options:
1. Update PR (push committed)
2. View PR in browser
3. Continue to CI monitoring
```

**If no PR exists**:
→ Continue to **5.3 Create PR**

### 5.3 Create PR

**Generate PR description**:

```markdown
## Summary

[Brief 1-2 sentence overview of what this PR does]

## Changes

- [Auto-generated list from commit messages]
- [Bullet points for each significant change]

## Testing

- ✅ Unit tests: [pass/fail count]
- ✅ Integration tests: [pass/fail count]
- ✅ E2E tests: [suite run, pass/fail count]

## Related Issues

Closes #[issue number if provided]

## Checklist

- [x] Preflight passed locally
- [x] No merge conflicts with main
- [x] Tests added/updated for changes
- [ ] CI checks passing (monitoring...)
```

**Ask the user**:

```
I've drafted a PR description.

Options:
1. Create PR with this description
2. Edit description
3. Create as DRAFT PR (for WIP)
```

**Create PR**:

```bash
# For regular PR
gh pr create --title "<title>" --body "<description>"

# For draft PR
gh pr create --title "<title>" --body "<description>" --draft
```

---

## Phase 6: CI Monitoring (Optional)

**Ask the user**:

```
PR #123 created successfully!
URL: https://github.com/timothyfroehlich/PinPoint/pull/123

Would you like me to monitor GitHub Actions for this PR?
I'll watch for:
  - Build status
  - Test results
  - Linting/type checks

Options:
1. Watch CI (block until all checks pass/fail, max 10 minutes)
2. Watch CI in background (I'll notify when complete)
3. Skip monitoring (you can check manually)
```

### 6.1 Watch CI (if user approves)

**Implementation**:

```bash
# Poll every 30 seconds, timeout after 10 minutes
gh pr checks <pr-number> --watch --interval=30 --timeout=600
```

**Status Updates**:

```
⏳ Monitoring CI for PR #123...

[00:30] ✅ Build / Build and Test (ubuntu-latest)
[01:00] ✅ Lint / ESLint
[01:00] ✅ Type Check / tsc
[01:30] 🔄 E2E Tests / Playwright (chromium) - In Progress
[03:00] ✅ E2E Tests / Playwright (chromium)
[03:00] 🔄 E2E Tests / Playwright (Mobile Chrome) - In Progress
```

**On Success**:

```
✅ All CI checks passed! (3m 45s)

Your PR is ready for review.

Next steps:
1. Request review from team (gh pr review <pr> --request)
2. Check PR in browser
3. Run Jules PR Manager for automated review
```

**On Failure**:

```
❌ CI checks failed

Failed checks:
  - E2E Tests / Playwright (chromium): 2 tests failed

View details: https://github.com/timothyfroehlich/PinPoint/actions/runs/123456

Options:
1. View failed test logs
2. Run failed tests locally (I can help debug)
3. Fix and push again
```

**On Timeout**:

```
⏱️  CI monitoring timed out after 10 minutes.
Some checks are still running.

View status: gh pr checks <pr-number>
Or visit: https://github.com/timothyfroehlich/PinPoint/pull/123
```

---

## Phase 7: Post-PR Actions

### 7.1 Offer Jules PR Manager Integration

**If Jules skill is available**:

```
✅ Commit, push, and PR complete!

Would you like me to run Jules PR Manager?
Jules will:
  - Analyze the PR for issues
  - Suggest improvements
  - Check for common mistakes

This helps catch issues before human review.

Options:
1. Run Jules PR Manager
2. Skip (you can run it later)
```

If user approves:

```
Loading Jules PR Manager skill...
[Execute .claude/skills/jules-pr-manager/SKILL.md workflow]
```

### 7.2 Final Summary

```
🎉 Workflow Complete! Summary:

✅ Committed: feat(issues): Add advanced filtering to issue list
✅ Pushed to: origin/feature/issue-filter-search
✅ PR Created: #123 (https://github.com/timothyfroehlich/PinPoint/pull/123)
✅ CI Status: All checks passing
✅ Jules Review: No blocking issues

Next Steps:
  - Request review: gh pr review 123 --request @reviewer
  - View PR: gh pr view 123 --web
  - Monitor CI: gh pr checks 123 --watch

Your code is ready for team review! 🚀
```

---

## Edge Cases & Error Handling

### Merge Conflicts with Main

Before pushing, check if branch is mergeable:

```bash
git fetch origin main
git merge-base --is-ancestor origin/main HEAD
```

If not:

```
⚠️  Your branch is behind main and may have conflicts.

Options:
1. Rebase onto main (git rebase origin/main)
2. Merge main into branch (git merge origin/main)
3. Continue anyway (may cause conflicts in PR)
```

### Husky Pre-Commit Hooks

If husky pre-commit hook fails:

```
❌ Pre-commit hook failed

Husky runs:
  - lint-staged (ESLint + Prettier on staged files)

The hook must pass before committing.

Options:
1. Let me run lint:fix and format:fix to auto-fix
2. Show hook output for debugging
3. Skip hooks (⚠️  NOT recommended: --no-verify)
```

### Large Files / LFS

Detect large files (>5MB):

```bash
git diff --staged --name-only | xargs ls -lh
```

If found:

```
⚠️  Large file detected: screenshots/demo.mp4 (15MB)

Large files slow down git and may exceed GitHub limits.

Options:
1. Add to .gitignore (exclude from commit)
2. Use Git LFS (if configured)
3. Compress file
4. Continue anyway
```

### Network Failures

If `git push` or `gh pr create` fails due to network:

```
❌ Push failed: Could not resolve host

Options:
1. Retry push
2. Check network connection
3. Push manually later (git push -u origin <branch>)
```

---

## Script Location

This workflow can reference helper scripts if needed:

- `scripts/sync_worktrees.py` - For worktree-specific actions
- `scripts/ensure-supabase.sh` - Ensure Supabase is running

---

## Turbo Mode

Steps marked `// turbo` will auto-run without user approval:

- `pnpm run preflight`
- E2E test suites (if user pre-approved)
- `git push`
- CI monitoring commands

All other steps require user confirmation.
