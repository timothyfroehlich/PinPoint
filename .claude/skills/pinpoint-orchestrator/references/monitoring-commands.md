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

```bash
# Preferred: MCP tools (called by agents directly)
# pull_request_read(method: "get_review_comments", owner: "timothyfroehlich", repo: "PinPoint", pullNumber: <PR>)
# add_reply_to_pull_request_comment(owner: "timothyfroehlich", repo: "PinPoint", pullNumber: <PR>, commentId: <ID>, body: "...")

# Resolve threads (MCP gap stopgap):
./scripts/workflow/resolve-thread.sh <PRRT_thread-node-id>
```

## Worktree Status

```bash
./pinpoint-wt.py list
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
