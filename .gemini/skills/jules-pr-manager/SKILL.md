---
name: Jules PR Manager
description: Manage Google Jules PR lifecycle - batch processing, priority sorting, and serial decision making.
version: 1.3.0
---

# Jules PR Manager

## Overview

**Manage the lifecycle of PRs created by Google's Jules agent (Gemini 2.5 Pro).**

This skill orchestrates a **Fetch-Analyze-Batch-Execute** loop to manage multiple PRs efficiently in a single-threaded CLI environment. It strictly prioritizes **finishing work** (merging) before **starting work** (vetting/reviewing).

**Core Principle**: **One decision per turn.** Automate everything else in batch.

## Execution Model

1.  **Fetch (Batch)**: Retrieve state of _all_ Jules PRs in one `gh` command.
2.  **Analyze**: Parse JSON to assign Priorities and identify "Stalled" PRs.
3.  **Automate (Batch)**: Execute non-blocking updates (timeouts, label cleanup) immediately.
4.  **Prioritize**: Select the _single_ highest-priority PR requiring user input.
5.  **Execute**: Apply the specific **Workflow** for that PR's state.

---

## Priority Logic: "Clear Exits, Vet Entrances, Then Grind"

Process PRs in this strict order. Stop at the first group that has candidates.

### 1. The Exit Ramp (High Value)

- **Priority 1: Ready to Merge**
  - _Condition_: Vetted + CI Passed + Copilot Approved + No Conflicts.
  - _Goal_: Ship finished code.
- **Priority 2: Copilot Comments Addressed**
  - _Condition_: `jules:copilot-comments` + Recent Jules commits.
  - _Goal_: Validate fixes and move to Merge.

### 2. The Gatekeeper (Vetting + Initial Review)

- **Priority 3: Unvetted PRs**
  - _Condition_: **Missing** `jules:vetted` label.
  - _Goal_: Filter duplicates -> Review Code -> Move to next stage (Copilot or Changes Requested).
  - _Note_: Combines "Vetting" and "Stage 1 Draft Review".

### 3. The Grind (In-Flight)

- **Priority 4: Stalled Agents**
  - _Condition_: `jules:agent-stalled`.
  - _Goal_: Manual intervention to unblock.
- **Priority 5: Copilot Reviews**
  - _Condition_: `jules:copilot-review` (Check if review finished).
  - _Goal_: Bridge Copilot comments to Jules.
- **Priority 6: Waiting**
  - _Condition_: `jules:changes-requested` (and not stalled).
  - _Goal_: Wait (no action).

---

## Execution Guidelines

### ⚠️ Critical: Interaction with Jules

Jules **ignores** regular comments. You must use **Reviews** to trigger action.

- **Requesting Changes**:
  ```bash
  gh pr review <ID> --request-changes --body "..."
  ```
- **Approving**:
  ```bash
  gh pr review <ID> --approve --body "..."
  ```
- **Do NOT use**: `gh pr comment` (unless you are reposting Copilot comments for _your own_ tracking, but even then, a review is safer).

## Decision Templates

**CRITICAL**: You MUST use these templates when asking for user confirmation. Do not deviate.

### 1. Vetting Template (Stage 6)

Use this when asking to approve a new PR (`jules:vetted`).

```markdown
## 🛡️ Vetting Request: PR #<ID>

**Title**: <Title>
**Type**: <Sentinel/Bolt/Palette>
**Summary**: <Brief summary of changes>
**Duplicates**: <None | List duplicates found and closed>
**CI**: <Passing/Failing/Running>
**Risk**: <High/Medium/Low based on files touched>

**Approve for processing?** (y/n)
```

### 2. Ready for Copilot Template (Stage 3)

Use this when moving from Human Review to Copilot Review.

```markdown
## 🤖 Hand off to Copilot: PR #<ID>

**Title**: <Title>
**Status**: Code reviewed, initial issues resolved.
**Next Step**: Label `jules:copilot-review`
**Validation**:

- [ ] Non-negotiables checked
- [ ] Basic logic verified

**Send to Copilot?** (y/n)
```

### 3. Merge Template (Tier 1)

Use this for the final merge decision.

```markdown
## 🚀 Ready to Merge: PR #<ID>

**Title**: <Title>
**Type**: <Sentinel/Bolt/Palette>
**Changes**: <Summary of impact>
**CI**: ✅ Passed
**Conflicts**: None
**Recommendation**: MERGE

**Confirm auto-merge?** (y/n)
```

## Workflows

### 🏁 The Exit Ramp: Merging (Priority 1)

**Trigger**: CI passed, Reviews passed, No conflicts.

1.  **Final Check**: Ensure `NON_NEGOTIABLES.md` compliance.
2.  **Context**: Gather summary of changes + "Why".
3.  **Action**: **Use Merge Template** to ask user.

### 🛡️ The Gatekeeper: Vetting & Review (Priority 3)

**Trigger**: PR is missing `jules:vetted`.

1.  **Duplicate Check**:
    ```bash
    gh pr list --search "is:open author:app/google-labs-jules <keywords>"
    gh pr diff <ID> > new.diff
    gh pr diff <EXISTING> > old.diff
    diff -u new.diff old.diff | head
    ```
2.  **Analyze**: Duplicate? Junk? Good?
3.  **Code Review**: If unique, review code _now_. Check that **Prettier**, **ESLint**, and **Unit Tests** pass.
4.  **Action**:
    - **Duplicate**: Comment on winner with code from loser, close loser.
    - **Bad**: Close with feedback.
    - **Good**: **Use Vetting Template** to ask user. (If approved AND CI passes, add `jules:vetted` -> `jules:copilot-review`).
    - **Issues (or CI Failure)**: **Use Vetting Template** (noting issues/failing checks). If approved, add `jules:vetted` -> Request Changes -> Add `jules:changes-requested`.

### 🌉 The Bridge: Copilot Handling (Priority 5)

**Trigger**: `jules:copilot-review`.

**CRITICAL**: Jules cannot see Copilot reviews.

1.  **Check Status**: Has Copilot finished? (State: `COMMENTED` / `CHANGES_REQUESTED`).
2.  **Fetch**: Get comments via `gh api`.
3.  **Repost**: Post each comment as a new comment from YOU, tagging `@google-labs-jules`.
4.  **Label**: Swap `jules:copilot-review` -> `jules:copilot-comments`.

---

## Workflow Commands

### 1. Batch Fetch (The "State of the World")

Always start by fetching ALL relevant data.

```bash
gh pr list \
  --search "author:app/google-labs-jules is:open" \
  --json number,title,labels,createdAt,updatedAt,headRefName,mergeable,reviews,statusCheckRollup,isDraft \
  > .gemini/tmp/jules_prs.json
```

### 2. Timeout Automation (Batch)

Check for stalled agents (>30 mins silence) _before_ interacting with user.

**Logic:**

- **Target**: Labels `jules:changes-requested` OR `jules:copilot-comments`.
- **Condition**: `updatedAt` > 30 mins ago AND Last Actor != `app/google-labs-jules`.
- **Action**: Add `jules:agent-stalled`.

### 3. Conflict Check

If `mergeable: "CONFLICTING"`, apply `jules:merge-conflicts`.
**Note**: Do NOT attempt to fix conflicts automatically in the CLI. Ask user to resolve locally.

## GitHub Labels Reference

| Label                     | Category | Meaning                                    |
| :------------------------ | :------- | :----------------------------------------- |
| `jules:vetted`            | **Gate** | **REQUIRED**. Approved for processing.     |
| `jules:draft-review`      | Stage    | (Legacy) Initial human review.             |
| `jules:changes-requested` | Wait     | Waiting for Jules to fix human feedback.   |
| `jules:copilot-review`    | Wait     | Waiting for Copilot.                       |
| `jules:copilot-comments`  | Wait     | Waiting for Jules to fix Copilot feedback. |
| `jules:agent-stalled`     | Alert    | >30m silence. Needs help.                  |
| `jules:merge-conflicts`   | Alert    | Git conflict. Needs manual fix.            |

## Common Mistakes

- **Reviewing Unvetted PRs**: Wastes time on duplicates. Vet first.
- **Ignoring the Exit Ramp**: Don't start new drafts if you have PRs ready to merge.
- **Silent Merging**: Always get explicit "y" confirmation.
- **Assuming Jules Reads Copilot**: It doesn't. You must be the bridge.

## Agent Search Optimization (ASO)

**Description**: Manage Google Jules PR lifecycle - gatekeeper vetting, batch processing, and priority sorting.
**Keywords**: jules, google-labs-jules, pr manager, batch, prioritization, timeout, stalled, merge, vetting, gatekeeper
