---
name: pinpoint-ready-to-review
description: Use when a PR exists and needs to be verified and labeled ready for human review. Triggers on "ready to review", "get it ready", "mark as ready", "address copilot", "label ready", or after pushing a PR branch.
---

# PinPoint: Ready-to-Review

Three steps must complete before a PR is ready for human review: CI must pass, Copilot comments must be addressed, then `label-ready.sh` applies the label.

---

## Step 1: Watch CI

```bash
gh pr checks <PR>
```

Poll every 30s, max 10 minutes:

| Status           | Action                                       |
| ---------------- | -------------------------------------------- |
| All passing      | Proceed to Step 2                            |
| Any failed       | Stop — investigate and fix before continuing |
| Timeout (10 min) | Report to user, leave PR open                |

---

## Step 2: Copilot Review Loop

After CI passes, wait for Copilot to review:

```bash
bash scripts/workflow/copilot-comments.sh <PR>
```

**Poll loop (up to 5 minutes):**

```bash
for i in $(seq 1 5); do
    output=$(bash scripts/workflow/copilot-comments.sh $PR_NUMBER)
    echo "$output"
    echo "$output" | grep -q "⏳" || break
    sleep 60
done
```

| Output                         | Meaning                 |
| ------------------------------ | ----------------------- |
| `⏳ Copilot review pending`    | Wait and retry          |
| `✅ Copilot review is current` | Review is up to date    |
| No review after 5 min          | Mark timed out, proceed |

**If comments exist:**

1. Evaluate each critically — not all Copilot suggestions are correct
2. Reply and resolve: `bash scripts/workflow/respond-to-copilot.sh <PR> "path:line" "Fixed: ... —Claude"`
3. Push fix, then poll again — Copilot may re-review after the push

---

## Step 3: Label Ready

Once CI is green and Copilot comments are resolved:

```bash
bash scripts/workflow/label-ready.sh <PR>
```

This script verifies CI + Copilot status + draft state before applying the label. Use `--dry-run` to preview without acting.
