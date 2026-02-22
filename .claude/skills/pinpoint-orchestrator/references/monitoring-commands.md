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
# Preferred (uses project scripts)
bash scripts/workflow/copilot-comments.sh <PR>

# Raw API
gh api repos/timothyfroehlich/PinPoint/pulls/<PR_NUMBER>/comments \
  --jq '.[] | select(.user.login == "Copilot") | "File: \(.path):\(.line // .original_line)\n\(.body)\n---"'
```

## Worktree Status

```bash
./pinpoint-wt.py list
bash scripts/workflow/stale-worktrees.sh           # Report status
bash scripts/workflow/stale-worktrees.sh --clean    # Auto-remove stale
```

## Orchestration Startup

```bash
bash scripts/workflow/orchestration-status.sh    # Full picture: PRs + worktrees + beads + security
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
