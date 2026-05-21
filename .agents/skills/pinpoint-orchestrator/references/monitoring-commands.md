# Monitoring Commands Reference

Quick reference for PinPoint-specific monitoring during orchestration.

## PR Status

```bash
gh pr list --head <branch-name> --json number,url,title
gh pr list --head feat/my-feature --json number --jq '.[0].number'
```

## CI Status

```bash
gh pr checks <PR_NUMBER>                                    # Quick pass/fail
gh pr checks <PR_NUMBER> --watch                            # Wait for completion
gh pr view <PR_NUMBER> --json statusCheckRollup \
  --jq '.statusCheckRollup[] | select(.conclusion == "FAILURE") | .name'  # Failures only
```

## Copilot Review Comments

Preferred: use MCP via the `pinpoint-pr-workflow` skill (Phase 3.2-3.3).

```
mcp__github__pull_request_read(
  method: "get_review_comments",
  owner: "timothyfroehlich",
  repo: "PinPoint",
  pullNumber: <PR>,
  perPage: 100
)
```

Filter to threads where `comments[0].author.login` is `copilot-pull-request-reviewer` or `copilot-pull-request-reviewer[bot]`. Each thread has `is_resolved` (snake_case), `is_outdated`, and a thread node ID (`PRRT_kwDOxxx`) for resolving via `mcp__github__pull_request_review_write(method: "resolve_thread", threadId)`.

Fallback (raw REST):

```bash
gh api repos/timothyfroehlich/PinPoint/pulls/<PR_NUMBER>/comments --paginate \
  --jq '.[] | select(.user.login | test("^copilot-pull-request-reviewer(\\[bot\\])?$")) | "File: \(.path):\(.line // .original_line)\n\(.body)\n---"'
```

## Worktree Status

```bash
git worktree list
./scripts/workflow/stale-worktrees.sh           # Report status
./scripts/workflow/stale-worktrees.sh --clean    # Auto-remove stale
```

## Orchestration Startup

```bash
./scripts/workflow/orchestration-status.sh    # Full picture: PRs + worktrees + beads + security
```

## Batch PR Check

```bash
for pr in $(gh pr list --author @me --state open --json number --jq '.[].number'); do
  echo "=== PR #$pr ==="
  gh pr view $pr --json title,statusCheckRollup --jq '"\(.title)\nChecks: \([.statusCheckRollup[] | .conclusion // .status] | unique | join(", "))"'
done
```

---

## Status Report Template

```markdown
## Agent Status Report

| Task       | PR           | CI Status    | Copilot Comments |
| ---------- | ------------ | ------------ | ---------------- |
| {beads_id} | #{pr_number} | {ci_summary} | {comment_count}  |

### PRs Ready for Review

- #{pr}: {title} - All checks passing

### PRs Needing Attention

- #{pr}: {title} - {issue_description}
```
