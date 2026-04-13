---
name: pinpoint-ready-to-review
description: Use when a PR exists and needs to be verified and labeled ready for human review. Triggers on "ready to review", "get it ready", "mark as ready", "address copilot", "label ready", or after pushing a PR branch.
---

# PinPoint: Ready-to-Review

This skill is self-contained. No external skill prerequisites.

---

## Overview

Three steps: CI must pass, Copilot review comments must be addressed, then label ready.

---

## Step 1: Monitor CI

Use `pr-watch.py` via the Monitor tool (Claude Code / Antigravity) or directly (Gemini CLI):

```
# Claude Code / Antigravity — Monitor tool (one notification per event):
Monitor(command="./scripts/workflow/pr-watch.py <PR>", description="CI watch for PR #<PR>", persistent=false, timeout_ms=3600000)

# Gemini CLI / terminal — foreground blocking:
./scripts/workflow/pr-watch.py <PR>
```

Exit 0 = all passed (or Copilot review interrupt). Exit 1 = failure — read `tmp/gh-monitor/failure-<RUN_ID>.md`.

Manual polling loops are blocked by a pre-tool-use hook. Always use the script.

---

## Step 2: Handle Review Comments

```bash
./scripts/workflow/copilot-comments.sh <PR>              # Show unresolved Copilot threads
./scripts/workflow/respond-to-copilot.sh <PR> <path:line> <msg>  # Reply + resolve one thread
```

**Rules:**

- **Sign all replies** with your agent name: `"Fixed: <description>. —Claude"` (or `—Gemini`, `—Antigravity`, etc.)
- **Keep replies to one sentence**
- **Applied suggestions auto-resolve** — Copilot detects your fix commit and closes the thread automatically. No reply needed.
- **Declined comments need a manual reply** — no silent ignores. Explain why in one sentence.
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
python3 scripts/worktree_cleanup.py ../pinpoint-worktrees/<branch>
```

### Optional: Update beads

If the PR is tracked by a beads issue, update its status after labeling.
