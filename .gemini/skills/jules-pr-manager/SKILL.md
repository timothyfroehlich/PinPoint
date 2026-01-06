---
name: Jules PR Manager
description: Manage Google Jules PR lifecycle - batch investigation, reverse-order processing, and tiered decision presentation.
version: 2.1.0
---

# Jules PR Manager

## Overview

**Manage the lifecycle of PRs created by Google's Jules agent (Gemini 2.5 Pro).**

This skill orchestrates a **Batch-Analyze-Present-Execute** loop. It strictly prioritizes **finishing work** (merging) before **starting work** (vetting) and aggregates trivial decisions to minimize user round-trips.

**Core Principle**: **Investigate ALL PRs in one turn.** Log their state, collect decisions, and present them in a tiered manner (Merge -> Vetting -> Trivial Batch). Always fetch PR activity using `gh pr view <ID> --json reviews,comments,commits` to ensure a high-fidelity understanding of the current state before presenting decisions. Vetting requests MUST be presented **one at a time** for focused consideration. Always include `@jules` in review comments to Jules for better context.

## State Machine (Reverse Order)

Process PRs in this order (Closest to Merge first):

### 1. Merge Candidates (The Exit)

- **Definition**: PRs that have already been vetted and are now ready for a final merge decision.
- **State**: `copilot-review` (Approved) or `changes-requested` (Resolved).
- **Conditions**:
  - **Ready to Merge**: Copilot Approved AND CI Passed AND No Conflicts.
  - **Action**: Present **Merge Decision**.

### 2. Copilot Review (`jules:copilot-review`)

- **Conditions**:
  - **Copilot Finished (Comments)**: Copilot left unaddressed comments.
    - **Action**: **Validate Comments**.
      - Filter out hallucinations or bad advice.
      - Copy _valid_ comments to new review for Jules -> Set `jules:changes-requested`. (Trivial Batch)
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

- **Definition**: PRs that have just been created and require an initial assessment of whether the work is worth doing.
- **Conditions**: Missing `jules:vetted`.
- **Logic**:
  1.  **Duplicate Detection**:
      - Identify duplicates (similar title/desc).
      - **Pick Keeper**: Best implementation wins.
      - **Merge Changes**: If losers have good parts, post review on Keeper requesting them.
      - **Close Losers**: Mark as duplicates.
  2.  **Vetting**:
      - Short Code Review: Is this worth doing? Provide 2x detail on the rationale, pros/cons, and impact.
      - **Action**: Present **Vetting Decision** (Approve/Close) **individually**.

### 5. Exceptions

- **Stalled** (`jules:agent-stalled`): Needs manual intervention.
- **Conflicts** (`jules:merge-conflicts`): Needs manual resolution.

---

## Execution Model

### 1. Batch Investigation

- Fetch state of **ALL** open Jules PRs in one command.
- Iterate through all PRs.
- For each PR, fetch detailed activity: `gh pr view <ID> --json reviews,comments,commits`.
- Maintain a **Log** of each PR's status and proposed actions for this turn.

### 2. Decision Collection

- **Merge Decisions**: Collect full context for PRs ready to merge.
- **Vetting Decisions**: Collect full context (description, duplicates, opinion with deep rationale) for new PRs.
- **Trivial Decisions**: Collect simple actions (Label changes, Reposting comments, CI fixes) into a batch list.

### 3. Tiered Presentation

Present the collected decisions to the User in this **EXACT** order:

1.  **Merge Decisions**: Present each ready-to-merge PR one by one.
2.  **Vetting Requests**: Present each new vetting request **one at a time**. Include detailed pros/cons and why the work is valuable.
3.  **Trivial Batch**: Presented as a numbered list for bulk approval.

### 4. Batch Execution

- Execute **ALL** approved actions in a single batch of commands/requests.
- **Backgrounding**: Run `gh` commands in the background (using `&`) whenever possible to avoid blocking the CLI and improve perceived responsiveness.

---

## ⚠️ Critical Interaction Rules

**Jules ignores regular comments.** You must use **Reviews** to trigger action. Always reference `@jules` in the review body.

- **Requesting Changes**:
  ```bash
  gh pr review <ID> --request-changes --body "@jules ..."
  ```
- **Approving**:
  ```bash
  gh pr review <ID> --approve --body "@jules ..."
  ```
- **Merging**:
  ```bash
  gh pr merge <ID> --squash --delete-branch
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

### 2. Vetting Request (Priority 2)

```markdown
## 🛡️ Initial Vetting: PR #<ID>

**Title**: <Title>
**Summary**: <Description>
**Worth it?**: <Detailed Agent Opinion: Why is this work valuable? What are the specific pros and cons? What is the architectural impact?>
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
- **Review**: `gh pr review <ID> --request-changes --body "@jules ..."

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
