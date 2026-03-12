---
name: pinpoint-ready-to-review
description: Use when a PR exists and needs to be verified and labeled ready for human review. Triggers on "ready to review", "get it ready", "mark as ready", "address copilot", "label ready", or after pushing a PR branch.
---

# PinPoint: Ready-to-Review

Three steps must complete before a PR is ready for human review: CI must pass,
Copilot comments must be addressed via MCP, then `label-ready.sh` applies the label.

---

## Step 1: Watch CI

**Use the dedicated monitoring script — never write a manual polling loop:**

```bash
./scripts/workflow/monitor-gh-actions.sh <PR>
```

| Exit condition   | Action                                       |
| ---------------- | -------------------------------------------- |
| All passing      | Proceed to Step 2                            |
| Any failed       | Stop — investigate and fix before continuing |
| Timeout (10 min) | Report to user, leave PR open                |

---

## Step 2: Fetch Copilot Comments (MCP + Subagent)

After CI passes, spawn a **lightweight subagent** to fetch and summarize Copilot review
comments. This protects the main context from large API responses.

**Subagent model:** Use a small, fast model — Claude Haiku (`claude-haiku-4-5-20251001`),
Gemini Flash, or equivalent. The task is simple data extraction, not reasoning.

**Subagent prompt:**

> Fetch review comments for PR #<NUMBER> on timothyfroehlich/PinPoint using MCP tools.
>
> 1. Call `pull_request_read` with `method: "get_review_comments"`, `owner: "timothyfroehlich"`, `repo: "PinPoint"`, `pullNumber: <NUMBER>`.
> 2. Filter to threads where:
>    - `isResolved` is `false`
>    - The first comment's author login contains `copilot`
> 3. Return a structured summary as a markdown table:
>
>    ```
>    | File:Line | Comment ID | Thread ID | Summary |
>    ```
>
>    - `Comment ID`: the numeric `databaseId` or `id` field (needed for `add_reply_to_pull_request_comment`)
>    - `Thread ID`: the node ID like `PRRT_...` (needed for `resolve-thread.sh`)
>    - `Summary`: first 80 chars of the comment body
>
> 4. If no unresolved Copilot threads exist, return "No unresolved Copilot comments."
> 5. Also report review freshness: call `pull_request_read` with `method: "get_reviews"`.
>    If the latest Copilot review's `submittedAt` is older than the PR's head commit date,
>    report "Copilot review pending (last push is newer than last review)."

**If review is pending:** Wait 60s and re-check, up to 5 times. Copilot typically
reviews within 2-3 minutes.

**If comments exist:**

1. Evaluate each critically — not all Copilot suggestions are correct
2. Fix code or decide to ignore with justification
3. Reply via MCP:
   ```
   Call: add_reply_to_pull_request_comment
     owner: "timothyfroehlich"
     repo: "PinPoint"
     pullNumber: <PR>
     commentId: <Comment ID from subagent>
     body: "Fixed: <what you did>. —<AgentName>"
   ```
4. Resolve via script (MCP can't do this yet):
   ```bash
   ./scripts/workflow/resolve-thread.sh <Thread ID from subagent>
   ```
5. Push fix, then re-run the subagent — Copilot may re-review after the push

**Rules:**

- Every Copilot comment gets a reply — no silent fixes or silent ignores
- Keep replies to one sentence
- Sign with agent name (`—Claude`, `—Gemini`, `—Codex`, etc.)
- If Copilot is wrong, say why (helps future reviews)

---

## Step 3: Label Ready

Once CI is green and Copilot comments are resolved:

```bash
./scripts/workflow/label-ready.sh <PR>
```

This script verifies CI + unresolved Copilot thread count + draft state before applying
the label. Use `--dry-run` to preview without acting.
