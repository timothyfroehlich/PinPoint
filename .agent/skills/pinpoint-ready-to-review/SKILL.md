---
name: pinpoint-ready-to-review
description: Use when a PR exists and needs to be verified and labeled ready for human review. Triggers on "ready to review", "get it ready", "mark as ready", "address copilot", "label ready", or after pushing a PR branch.
---

# PinPoint: Ready-to-Review

**Prerequisites:** Install and load the `gha-ready-to-review` skill for the base workflow
(MCP-primary instructions, monitor script, review handling patterns).

Install: `npx skills add timothyfroehlich/gha-workflow-skills`

This skill adds PinPoint-specific behavior on top of the generic workflow.

---

## Overview

Three steps: CI must pass, Copilot review comments must be addressed, then label ready.
Follow the `gha-ready-to-review` skill for each step, with these PinPoint additions:

---

## Step 1: Monitor CI

Use the monitor script from `gha-ready-to-review` (installed at
`~/.agents/skills/gha-ready-to-review/scripts/monitor-gh-actions.sh`):

```bash
# Background (preferred — lets you work on reviews while CI runs):
~/.agents/skills/gha-ready-to-review/scripts/monitor-gh-actions.sh <PR> \
  --output /tmp/gha-monitor-<PR>.md &

# Check status anytime:
cat /tmp/gha-monitor-<PR>.md
```

Manual polling loops are blocked by a pre-tool-use hook. Always use the script.

---

## Step 2: Handle Review Comments

Follow `gha-ready-to-review` for MCP-first or shell-fallback review handling.

### PinPoint additions:

- **Sign all replies** with your agent name: `"Fixed: <description>. —Claude"` (or `—Gemini`, `—Antigravity`, etc.)
- **Keep replies to one sentence**
- **Applied suggestions auto-resolve** — Copilot detects your fix commit and closes the thread automatically
- **Declined comments need a manual reply** — no silent ignores. Use `respond-to-copilot.sh` only for these.
- **Evaluate critically** — not all Copilot suggestions are correct. If wrong, say why.
- **Filter to Copilot threads** using reviewer login allowlist:
  `copilot-pull-request-reviewer` or `copilot-pull-request-reviewer[bot]`

---

## Step 3: Label Ready

Once CI is green and Copilot review comments are resolved:

```bash
# PinPoint's label-ready script (validates CI + reviews + draft status):
./scripts/workflow/label-ready.sh <PR>
```

Use `--dry-run` to preview. Use `--force` to skip Copilot check.

### Optional: Clean up worktree

```bash
./scripts/workflow/label-ready.sh <PR> --cleanup
# Or manually:
./pinpoint-wt.py remove <branch>
```

### Optional: Update beads

If the PR is tracked by a beads issue, update its status after labeling.
