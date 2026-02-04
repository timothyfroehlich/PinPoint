# Monitoring Commands Reference

Quick reference for monitoring subagent work and PR status.

## PR Status

### List PRs by Branch

```bash
gh pr list --head <branch-name> --json number,url,title
```

### Get PR Number from Branch

```bash
gh pr list --head feat/my-feature --json number --jq '.[0].number'
```

## CI Status

### Quick Check (Pass/Fail)

```bash
gh pr checks <PR_NUMBER>
```

### Detailed Status (JSON)

```bash
gh pr view <PR_NUMBER> --json statusCheckRollup --jq '.statusCheckRollup[] | "\(.name): \(.conclusion // .status)"'
```

### Filter for Failures Only

```bash
gh pr view <PR_NUMBER> --json statusCheckRollup --jq '.statusCheckRollup[] | select(.conclusion == "FAILURE") | .name'
```

### Wait for Checks to Complete

```bash
gh pr checks <PR_NUMBER> --watch
```

## Copilot Review Comments

### Get All PR Comments

```bash
gh api repos/timothyfroehlich/PinPoint/pulls/<PR_NUMBER>/comments
```

### Filter Copilot Comments Only

```bash
gh api repos/timothyfroehlich/PinPoint/pulls/<PR_NUMBER>/comments \
  --jq '.[] | select(.user.login == "Copilot") | "File: \(.path):\(.line // .original_line)\n\(.body)\n---"'
```

### GraphQL Query (Includes Hidden Comments)

```bash
gh api graphql -f query='{
  repository(owner: "timothyfroehlich", name: "PinPoint") {
    pullRequest(number: <PR_NUMBER>) {
      reviews(last: 5) {
        nodes {
          author { login }
          state
          comments(first: 20) {
            nodes { path line body }
          }
        }
      }
    }
  }
}'
```

## Agent Status

### Check Background Agent (Non-blocking)

```
TaskOutput tool with:
  task_id: <agent_id>
  block: false
  timeout: 5000
```

### Read Agent Output File

```bash
tail -50 /tmp/claude-1000/-home-froeht-Code-PinPoint-AntiGravity/tasks/<agent_id>.output
```

## Worktree Status

### List All Worktrees

```bash
./pinpoint-wt list
```

### Check Worktree Git Status

```bash
cd /home/froeht/Code/pinpoint-worktrees/<branch> && git status
```

### Check Worktree Commits

```bash
cd /home/froeht/Code/pinpoint-worktrees/<branch> && git log --oneline -5
```

## Batch Monitoring Script

Check all open PRs from current user:

```bash
for pr in $(gh pr list --author @me --state open --json number --jq '.[].number'); do
  echo "=== PR #$pr ==="
  gh pr view $pr --json title,statusCheckRollup --jq '"\(.title)\nChecks: \([.statusCheckRollup[] | .conclusion // .status] | unique | join(", "))"'
  echo ""
done
```

## Status Report Template

```markdown
## Agent Status Report

| Task       | Agent    | PR           | CI Status    | Copilot Comments |
| ---------- | -------- | ------------ | ------------ | ---------------- |
| {beads_id} | {status} | #{pr_number} | {ci_summary} | {comment_count}  |

### PRs Ready for Review

- #{pr}: {title} - All checks passing

### PRs Needing Attention

- #{pr}: {title} - {issue_description}

### Still Running

- {beads_id}: Agent {agent_id} in progress
```
