---
name: Jules PR Manager
description: Manage Google Jules PR lifecycle - batch investigation, reverse-order processing, and tiered decision presentation.
version: 2.0.0
---

# Jules PR Manager

## Overview

**Manage the lifecycle of PRs created by Google's Jules agent (Gemini 2.5 Pro).**

This skill orchestrates a **Batch-Analyze-Present-Execute** loop. It strictly prioritizes **finishing work** (merging) before **starting work** (vetting) and aggregates trivial decisions to minimize user round-trips.

**Core Principle**: **Investigate ALL PRs in one turn.** Log their state, collect decisions, and present them in a tiered manner (Merge -> Vetting -> Trivial Batch).

## State Machine (Reverse Order)

Process PRs in this order (Closest to Merge first):

### 1. Merge Candidates (The Exit)

- **State**: `copilot-review` (Approved) or `changes-requested` (Resolved).
- **Conditions**:
  - **Ready to Merge**: Copilot Approved AND CI Passed AND No Conflicts.
  - **Action**: Present **Merge Decision**.

### 2. Copilot Review (`jules:copilot-review`)

- **Conditions**:
  - **Copilot Finished (Comments)**: Copilot left unaddressed comments.
    - **Action**: Copy comments to new review for Jules -> Set `jules:changes-requested`. (Trivial Batch)
  - **Copilot Finished (Approved)**: Move to Merge Candidate.
  - **CI Failed**: Post comment requesting fixes -> Set `jules:changes-requested`. (Trivial Batch)
  - **Stalled**: >30 mins since request. -> Set `jules:agent-stalled`. (Trivial Batch)

### 3. Changes Requested (`jules:changes-requested`)

- **Conditions**:
  - **Jules Responded**: New commits/comments from Jules.
    - **Action**: Review changes.
      - **Good**: Move to `jules:copilot-review` -> Request Copilot Review. (Trivial Batch)
      - **Bad**: Request additional changes. (Trivial Batch)
  - **Stalled**: >30 mins since request. -> Set `jules:agent-stalled`. (Trivial Batch)

### 4. New PRs (Unvetted / No Labels)

- **Conditions**: Missing `jules:vetted`.
- **Logic**:
  1.  **Duplicate Detection**:
      - Identify duplicates (similar title/desc).
      - **Pick Keeper**: Best implementation wins.
      - **Merge Changes**: If losers have good parts, post review on Keeper requesting them.
      - **Close Losers**: Mark as duplicates.
  2.  **Vetting**:
      - Short Code Review: Is this worth doing?
      - **Action**: Present **Vetting Decision** (Approve/Close).

### 5. Exceptions

- **Stalled** (`jules:agent-stalled`): Needs manual intervention.
- **Conflicts** (`jules:merge-conflicts`): Needs manual resolution.

---

## Execution Model

### 1. Batch Investigation

- Fetch state of **ALL** open Jules PRs in one command.
- Iterate through all PRs.
- Maintain a **Log** of each PR's status and proposed actions for this turn.

### 2. Decision Collection

- **Merge Decisions**: Collect full context for PRs ready to merge.
- **Vetting Decisions**: Collect full context (description, duplicates, opinion) for new PRs.
- **Trivial Decisions**: Collect simple actions (Label changes, Reposting comments, CI fixes) into a batch list.

### 3. Tiered Presentation

Present the collected decisions to the User in this **EXACT** order:

1.  **Merge Decisions** (One at a time, strictly first).
2.  **Vetting Decisions** (One at a time).
3.  **Trivial Batch** (Presented as a numbered list for bulk approval).

### 4. Batch Execution

- Execute **ALL** approved actions in a single batch of commands/requests.

---

## ⚠️ Critical Interaction Rules

**Jules ignores regular comments.** You must use **Reviews** to trigger action.

- **Requesting Changes**:
  ```bash
  gh pr review <ID> --request-changes --body "..."
  ```
- **Approving**:
  ```bash
  gh pr review <ID> --approve --body "..."
  ```
- **DO NOT USE**: `gh pr comment` for instructing Jules. (Only use it for your own notes or if reposting Copilot comments _specifically_ as part of a review chain, but even then, a Review is preferred).

---

## Decision Templates

### 1. Merge Decision (Priority 1)

```markdown
## 🚀 Ready to Merge: PR #<ID>

**Title**: <Title>
**Summary**: <Impact>
**CI**: ✅ Passed
**Copilot**: ✅ Approved
**Recommendation**: MERGE

**Action**: Merge? (y/n/close)
```

### 2. Vetting Decision (Priority 2)

```markdown
## 🛡️ Vetting Request: PR #<ID>

**Title**: <Title>
**Summary**: <Description>
**Worth it?**: <Agent Opinion>
**Duplicates**: <None | Closed #X, #Y>

**Action**: Vet & Process? (y/n/close)
```

### 3. Trivial Batch (Priority 3)

```markdown
## ⚡ Batch Updates

1. **PR #123**: Repost Copilot comments -> `changes-requested`
2. **PR #124**: Jules responded -> Move to `copilot-review`
3. **PR #125**: CI Failed -> Request fixes

**Action**: Approve All? (y/n)
```

---

## Workflow Commands

### 1. Fetch All PRs

```bash
gh pr list \
  --search "author:app/google-labs-jules is:open" \
  --json number,title,labels,updatedAt,headRefName,mergeable,reviews,statusCheckRollup,isDraft,body \
  > .gemini/tmp/jules_prs.json
```

### 2. Automation Helpers

- **Duplicate Diffing**: `gh pr diff <ID> > a.diff && gh pr diff <OTHER> > b.diff && diff -u a.diff b.diff`
- **Get Comments**: `gh api repos/:owner/:repo/pulls/<ID>/reviews/<REVIEW_ID>/comments`
- **Review**: `gh pr review <ID> --request-changes --body "..."

---

## GitHub Labels Reference

| Label                     | Meaning                                     |
| :------------------------ | :------------------------------------------ |
| `jules:vetted`            | Approved for processing.                    |
| `jules:copilot-review`    | Waiting for Copilot.                        |
| `jules:changes-requested` | Waiting for Jules (Fixes/Copilot comments). |
| `jules:agent-stalled`     | >30m silence.                               |
| `jules:merge-conflicts`   | Git conflict.                               |

## Agent Search Optimization (ASO)

**Keywords**: jules, pr manager, batch, prioritization, vetting, merge, duplicates, tiered presentation
