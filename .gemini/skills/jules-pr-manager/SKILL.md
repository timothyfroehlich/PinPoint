---
name: Jules PR Manager
description: Manage Google Jules PR lifecycle - batch processing, priority sorting, and serial decision making.
version: 1.0.0
---

# Jules PR Manager

## Overview

**Manage the lifecycle of PRs created by Google's Jules agent (Gemini 2.5 Pro).**

This skill orchestrates a **Fetch-Analyze-Batch-Execute** loop to manage multiple PRs efficiently in a single-threaded CLI environment. It enforces strict prioritization (merges first) and handles automated maintenance (timeouts) before asking for user input.

**Core Principle**: **One decision per turn.** Automate everything else in batch.

## Execution Model

1.  **Fetch (Batch)**: Retrieve state of _all_ Jules PRs in one `gh` command.
2.  **Analyze**: Parse JSON to assign Tiers (1-6) and identify "Stalled" PRs.
3.  **Automate (Batch)**: Execute non-blocking updates (labeling stalled PRs, removing waiting labels) immediately.
4.  **Decide**: Select the _single_ highest-priority PR requiring user input.
5.  **Execute**: Present context and ask for _one_ decision.

## PR Priority Tiers

Process PRs in this order. Stop at the first tier that has candidates.

1.  **Tier 1: Pre-Merge Validation** (Ready to merge)
    - _Condition_: No stage labels, CI passed, Reviews approved.
    - _Action_: Present Merge Confirmation.
2.  **Tier 2: Copilot Comments Addressed**
    - _Condition_: `jules:copilot-comments` + recent commits.
    - _Action_: Review changes, then validation.
3.  **Tier 6: Missing Vetting** (High Priority Filtering)
    - _Condition_: Missing `jules:vetted`.
    - _Action_: Duplicate check -> Manual Vetting.
4.  **Tier 3: Waiting for Copilot**
    - _Condition_: `jules:copilot-review`.
    - _Action_: Poll/Wait (or skip if waiting).
5.  **Tier 4: Waiting for Jules**
    - _Condition_: `jules:changes-requested`.
    - _Action_: Check timeout -> Stalled?
6.  **Tier 5: Draft Review**
    - _Condition_: `jules:draft-review` + `jules:vetted`.
    - _Action_: Initial code review.

## Workflow Commands

### 1. Batch Fetch (The "State of the World")

Always start by fetching ALL relevant data in one go to minimize tool calls.

```bash
gh pr list \
  --search "author:app/google-labs-jules is:open" \
  --json number,title,labels,createdAt,updatedAt,headRefName,mergeable,reviews,statusCheckRollup,isDraft \
  > .gemini/tmp/jules_prs.json
```

### 2. Timeout Analysis & Automation

Check timestamps to detect stalled agents (>30 mins silence) _only when the agent is expected to act_.

**Definition of Stalled:**

- **Time**: `updatedAt` > 30 mins ago.
- **State**: Label is `jules:changes-requested` OR `jules:copilot-comments`.
- **Actor**: The last timeline event was _NOT_ from the agent bot (`app/google-labs-jules`).

**Pattern:**

1.  Filter `.gemini/tmp/jules_prs.json` for PRs matching the **Time** and **State** criteria.
2.  **Verify last actor** (MANDATORY):
    For each candidate, fetch the timeline to confirm the agent hasn't already responded.
    ```bash
    gh pr view <PR> --json timelineItems --jq '.timelineItems[-1].actor.login'
    ```
    _If the last actor is `google-labs-jules`, do NOT label as stalled._
3.  **Batch Update**:
    Only label confirmed stalled PRs.
    ```bash
    gh pr edit <ID> --add-label "jules:agent-stalled"
    ```

### 3. Duplicate Detection (Tier 6)

Before vetting, check for duplicates. **Only runs for PRs missing `jules:vetted`.**

```bash
# 1. Identify potential duplicates (same title/files)
gh pr list --search "is:open author:app/google-labs-jules <keywords>" --json number,title

# 2. Compare diffs (efficiently)
gh pr diff <New_PR> > new.diff
gh pr diff <Existing_PR> > existing.diff
diff -u new.diff existing.diff | head -n 20 # Check for significant overlap
```

### 4. Merge Confirmation (Tier 1)

Present full context before asking "y/n".

**Template:**

```markdown
## Ready to Merge: PR #<ID>

**Title**: <Title>
**Type**: <Sentinel/Bolt/Palette>
**Changes**: <Summary>
**CI**: ✅ Passed
**Conflicts**: None
**Recommendation**: MERGE

**Confirm auto-merge?** (y/n)
```

## Common Mistakes

- **Asking "What next?"**: You are the manager. You decide what's next based on priority tiers.
- **Processing Tier 5 before Tier 1**: Always clear the exit ramp (merges) before filling the entrance (drafts).
- **Ignoring `jules:vetted`**: Processing un-vetted PRs wastes tokens on duplicates or hallucinations.
- **Manual Conflict Resolution in Shell**: Complex conflicts are hard to fix via CLI. Instruct user to fix locally if `git merge` fails cleanly.

## GitHub Labels Reference

| Label                     | Meaning                   | Action                  |
| :------------------------ | :------------------------ | :---------------------- |
| `jules:draft-review`      | Initial Review            | Review code             |
| `jules:changes-requested` | Waiting for Jules         | Check timeout           |
| `jules:copilot-review`    | Waiting for Copilot       | Wait/Poll               |
| `jules:copilot-comments`  | Copilot comments reposted | Wait for Jules          |
| `jules:merge-conflicts`   | Conflicts                 | **User** fixes (manual) |
| `jules:agent-stalled`     | >30m silence              | Manual intervention     |
| `jules:vetted`            | Approved for processing   | Required for work       |

## Anti-Patterns

- **❌ Checking out PR branches**: Switching branches is disruptive to the user's worktree and often unnecessary. **Fix**: Use `gh pr diff` and `gh pr view` for analysis. If checks fail, report the failure or repost the logs for the agent.
- **❌ The "Wall of Text"**: Listing status for 10 PRs and asking "What first?". **Fix**: Pick the winner, present only that.
- **❌ Serial Fetching**: `gh pr view 101`, then `102`, then `103`. **Fix**: `gh pr list --json ...`
- **❌ Assuming Jules reads Copilot**: Jules is blind to Copilot. You must repost comments.
- **❌ Silent Merging**: Never merge without explicit "y" from user in that specific turn.

## Agent Search Optimization (ASO)

**Description**: Manage Google Jules PR lifecycle - batch processing, priority sorting, and serial decision making.
**Keywords**: jules, google-labs-jules, pr manager, batch, prioritization, timeout, stalled, merge
