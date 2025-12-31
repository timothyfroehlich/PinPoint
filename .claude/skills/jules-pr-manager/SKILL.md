# Jules PR Manager

Manage Jules (Google's AI agent) PR lifecycle from draft → ready → merge with continuous processing, parallel subagents, and intelligent duplicate detection.

## When to Use

Invoke this skill when:
- Managing open Jules PRs (scheduled: Sentinel/Bolt/Palette, or individual tasks)
- Need to process all Jules PRs in batch
- Handling duplicate PRs with smart consolidation
- Coordinating parallel work across PR types
- Waiting for Jules/Copilot to act on feedback

## Overview

**Jules** is Google's autonomous AI coding agent (Gemini 2.5 Pro) that creates PRs in three categories:
- 🛡️ **Sentinel**: Security improvements (input validation, XSS fixes)
- ⚡ **Bolt**: Performance optimizations (DB indexing, query parallelization)
- 🎨 **Palette**: Accessibility/UX enhancements (aria-labels, tooltips)

**Critical Constraints**:
1. **Jules CANNOT read GitHub Copilot review comments** - must be manually reposted
2. **High duplicate rate** - 5+ attempts on same issue common (consolidate intelligently)
3. **Merge conflict handling** - we handle them, not Jules (CHANGELOG conflicts handled by separate workflow)

**Learning Journals**: Jules maintains `.jules/{sentinel,bolt,palette}.md` with findings/learnings

---

## Execution Model

**Continuous Loop**: Runs until NO open Jules PRs remain (doesn't exit when waiting for agents)

**Batch Processing**: Processes PRs in priority order (tiers 1-6), max 5 subagents at a time (all non-blocking)

**Stage Advancement**: Automatically performs trivial actions (mark ready, apply labels)

**Maximum Parallelism** (CRITICAL):
- **NEVER wait when you can delegate**: If you can launch a background task and continue working, DO IT
- **Keep under 5 concurrent tasks**: Track active background tasks, stay under limit
- **Examples of what to background**:
  - PR status checks (gh pr view, gh pr diff, gh pr checks)
  - Copilot review comment retrieval
  - Merge conflict resolution in temp worktrees
  - Posting comments, applying labels
- **What NOT to background**:
  - User decisions (manual review must be presented one at a time)
  - Sequential dependencies (can't merge before CI passes)
- **Pattern**: Launch task → Continue to next PR → Check results later via TaskOutput

**Parallelization**:
- Rolling window: Max 5 subagents running concurrently (all non-blocking)
- Launch subagents in priority order (tier 1 → tier 6)
- When subagent finishes, launch next in queue immediately
- All subagent launches use `run_in_background=True` (never blocking)
- Main agent analyzes ALL results and makes decisions
- Manual review: One at a time (includes duplicate detection for tier 6)

**30-Minute Timeout**: Check WHO acted last. If WE acted and Jules/Copilot hasn't responded >30min (excluding 👀), label as `jules:agent-stalled`. If Jules acted last, ball is in OUR court for review!

---

## Orchestration Pattern

**YOU (the main agent) orchestrate the workflow. The jules-pr-manager subagent is your command executor.**

### Correct Pattern ✅

The main agent (YOU) makes all decisions based on the skill workflow. You launch jules-pr-manager subagent instances for specific, read-only tasks.

**Example 1: Simple operations - Use Bash directly**
```
# ✅ CORRECT: Posting a comment is 1-2 commands, use Bash directly
Bash(
    command='gh pr comment 672 --body "Copilot review comment on `file.ts:42`:\n> [comment text]\n\n@google-labs-jules please address this."',
    description="Post Copilot comment to PR #672"
)

# ✅ CORRECT: Removing labels is 1 command, use Bash directly
Bash(
    command='gh pr edit 690 --remove-label "jules:changes-requested"',
    description="Remove waiting label from PR #690"
)
```

**Example 2: Complex operations - Use subagent with background**
```
# ✅ CORRECT: Getting PR status requires 3+ commands, use subagent
pr_672_task = Task(
    subagent_type="jules-pr-manager",
    description="Get PR #672 full status",
    prompt="Execute these commands for PR #672:\n"
           "1. gh pr view 672 --json status,reviews,mergeable,headRefName\n"
           "2. gh pr diff 672\n"
           "3. gh pr checks 672\n"
           "4. Check timeline for last actor\n"
           "5. Get Copilot review status",
    run_in_background=True  # ✅ ALWAYS background when using subagents
)

pr_674_task = Task(
    subagent_type="jules-pr-manager",
    description="Get PR #674 full status",
    prompt="Execute these commands for PR #674:\n"
           "1. gh pr view 674 --json status,reviews,mergeable\n"
           "2. gh pr diff 674\n"
           "3. gh pr checks 674",
    run_in_background=True  # ✅ Parallel execution
)

# Wait for results
pr_672_data = TaskOutput(pr_672_task)
pr_674_data = TaskOutput(pr_674_task)

# Analyze and decide (main agent makes ALL decisions)
# Then execute simple actions with Bash directly
```

**Key Principles**:
- Main agent sees skill content, understands full workflow
- Main agent decides WHAT to do based on workflow stages
- jules-pr-manager subagent executes HOW (specific gh/git commands for READ-ONLY operations)
- Subagent is read-only: uses `git show`, `git merge-tree`, never modifies working dir
- **CRITICAL**: Main agent handles ALL merge conflicts (uses Bash tool directly, NOT subagent)
- **When to use subagents**: ONLY launch a subagent if you expect:
  - Strictly MORE than 2 tool calls, OR
  - Tool calls that involve longer round trips than posting a GitHub comment
- **When NOT to use subagents**: For simple 1-2 command operations (posting comments, applying labels), use Bash tool directly
- **When you DO use subagents**: ALWAYS use `run_in_background=True` for parallelization
- Iterate: launch subagents → analyze results → launch more as needed

### Wrong Pattern ❌

**DON'T DO THIS:**
```
# ❌ General-purpose subagent with high-level orchestration task
Task(
    subagent_type="general-purpose",
    prompt="Process all Sentinel PRs through the workflow"
)
```

**Why this is wrong**:
- General-purpose subagent doesn't see skill content
- Subagent makes its own decisions about workflow
- Subagent has Write/Edit tools, may modify working directory
- Subagent may run `git checkout`, `git merge`, leaving repo in bad state

---

## GitHub Labels

Each PR has exactly ONE stage label:

- `jules:draft-review` - Awaiting initial human review (yellow)
- `jules:changes-requested` - Waiting for Jules to address comments, 30min timeout (yellow)
- `jules:copilot-review` - Waiting for Copilot review (green)
- `jules:copilot-comments` - Copilot comments reposted for Jules, 30min timeout (red)
- `jules:merge-conflicts` - Has merge conflicts to resolve (red)
- `jules:agent-stalled` - Agent hasn't acted in 30+ min (red)
- `jules:manual-review` - Needs manual decision, presented one-at-a-time (purple)
- `jules:duplicate-candidate` - May be duplicate, needs comparison (yellow)

**Required approval label** (independent of stage):

- `jules:vetted` - User personally approved PR for processing (green)
  - **CRITICAL**: ALL PRs must have this label before any work is done
  - Missing this label → Auto-tag `jules:manual-review` for approval

---

## Workflow: Continuous Processing Loop

```
1. Initialize
   ├─ List all open Jules PRs
   ├─ Check timeline events: WHO acted last? (us vs Jules)
   ├─ Apply timeout ONLY if we acted last >30 min ago → label stalled PRs
   └─ If Jules acted last → Remove waiting labels, ready for our review

2. Sort PRs by Priority
   ├─ Assign each PR to tier (1, 2, 6, 3, 4, 5, or 7 for manual)
   ├─ Sort within each tier by age (oldest first)
   └─ Create ordered list of PRs to process

3. Launch jules-pr-manager Subagents (Rolling Window)
   ├─ Max 5 subagents running concurrently (all non-blocking)
   ├─ Process PRs in priority order (tier 1 → tier 5)
   ├─ When subagent finishes, launch next in queue immediately
   ├─ Skip PRs labeled `jules:manual-review` (handle separately)
   └─ Collect results via TaskOutput

4. Analyze Results & Make Decisions (Main Agent)
   ├─ Evaluate each PR based on workflow stages
   ├─ Decide which actions to take (comment, label, merge conflicts, etc.)
   └─ Identify PRs needing manual review

5. Execute Actions via jules-pr-manager Subagents
   ├─ Launch subagents for specific actions (post comments, apply labels)
   ├─ Handle merge conflicts in temporary worktrees
   └─ Wait for completion

6. Manual Review (one at a time, includes duplicate detection)
   ├─ Present first manual review PR with full context
   ├─ **If tier 6 (missing jules:vetted):**
   │  ├─ Run comprehensive duplicate detection
   │  ├─ If duplicate: close or consolidate (same logic as old stage)
   │  ├─ If not duplicate: Ask "Approve this PR for processing?"
   │  ├─ If user approves → Apply `jules:vetted` label
   │  └─ If user rejects → Close PR, document in `.jules/*.md`
   ├─ **If other manual review:**
   │  ├─ Present full context
   │  ├─ Wait for user decision
   │  └─ Execute user's decision
   └─ Move to next manual review PR

7. Check for Completion
   ├─ Check ALL remaining PRs
   ├─ If none remain → DONE
   ├─ If ALL are waiting (check timeline) → Sleep 5 min, loop to step 1
   └─ If any can be processed → Continue to step 2 (don't sleep)
```

---

## PR Priority Ordering

**Tiers** (process in this order):

1. **Tier 1 (highest priority)**: Stage 6 - Pre-merge validation
   - Label: None (between copilot-review and merge)
   - Why: Ready to merge, finish them first

2. **Tier 2**: Stage 4 - Copilot comments addressed
   - Label: `jules:copilot-comments` with recent Jules commits
   - Why: Close to merge, high value

3. **Tier 6**: Missing `jules:vetted` approval
   - Missing label: `jules:vetted`
   - Why: Vet early to clear out bad PRs, avoid wasted work

4. **Tier 3**: Stage 3 - Waiting for Copilot review
   - Label: `jules:copilot-review`
   - Why: Waiting on Copilot, can't advance yet

5. **Tier 4**: Stage 2 - Waiting for Jules to address comments
   - Label: `jules:changes-requested`
   - Why: Waiting on Jules, can't advance yet

6. **Tier 5 (lowest priority)**: Stage 1 - Draft review with vetting
   - Label: `jules:draft-review` AND has `jules:vetted`
   - Why: Already vetted but needs review, lower priority

**Within each tier**: Sort by PR age (oldest first) to prevent starvation

**Determine tier from PR data**:
```python
def get_pr_tier(pr):
    # Check labels and state
    labels = pr.labels
    has_vetted = "jules:vetted" in labels

    # Tier 6: Missing vetted approval (highest priority after 1-2)
    if not has_vetted:
        return 6

    # Tier 1: Pre-merge validation (no stage label, passed Copilot)
    if all(label not in labels for label in ["jules:draft-review", "jules:changes-requested",
                                               "jules:copilot-review", "jules:copilot-comments"]):
        if pr.reviews_approved:  # Copilot approved or no comments
            return 1

    # Tier 2: Copilot comments addressed (recent commits after copilot-comments)
    if "jules:copilot-comments" in labels:
        if has_recent_commits_after_label(pr, "jules:copilot-comments"):
            return 2

    # Tier 3: Waiting for Copilot review
    if "jules:copilot-review" in labels:
        return 3

    # Tier 4: Waiting for Jules to address comments
    if "jules:changes-requested" in labels:
        return 4

    # Tier 5: Draft review (has vetted, needs initial review)
    if "jules:draft-review" in labels and has_vetted:
        return 5

    # Default: manual review
    return 7  # Manual review (handled separately)
```

---

## Stage 1: Initial Draft Review

**When**: Jules creates draft PR (`isDraft: true`)

**Checklist**:
- [ ] **CRITICAL**: Check for `jules:vetted` label
  - If missing → Tag `jules:manual-review` to get user approval FIRST
  - If present → Proceed with review

**For PRs missing `jules:vetted` (Tier 6 - Manual Approval + Duplicate Check)**:

- [ ] **Run comprehensive duplicate detection**:
  1. Identify duplicates: PRs with similar titles/descriptions
  2. Compare diffs:
     ```bash
     gh pr diff <PR1> > pr1.diff
     gh pr diff <PR2> > pr2.diff
     diff -u pr1.diff pr2.diff
     ```
  3. Evaluate `.jules/*.md` entries: Pick PR with better learning documentation
  4. **If duplicate found**:
     - Pick winner (better `.jules/*.md` entry, more complete implementation)
     - Comment on winner with EXPLICIT code from losers:
       ```markdown
       This PR is the keeper. Please incorporate these improvements from #XXX:

       **From `file.ts` (line 42):**
       ```typescript
       // Better implementation
       code_here
       ```

       @google-labs-jules please add these exact changes.
       ```
     - Close losers:
       ```bash
       gh pr close <PR> --comment "Duplicate of #<winner> which has better implementation."
       ```
     - Move to next PR (don't vet this one, it's closed)
  5. **If not a duplicate**:
     - Continue to manual approval below

- [ ] **Manual Approval** (if not duplicate):
  - Present full context (title, description, diff, files changed)
  - Ask user: "Approve this PR for processing?"
  - If user approves → Apply `jules:vetted` label, continue to Stage 1 review
  - If user rejects → Close PR with explanation, document in `.jules/*.md`

**For PRs with `jules:vetted` (proceed with normal review)**:

- [ ] Identify PR type from title emoji (🛡️/⚡/🎨)
- [ ] Read PR description and understand changes
- [ ] Review changed files - are changes good/worth making?
- [ ] Validate against project standards:
  - [ ] `docs/NON_NEGOTIABLES.md` compliance
  - [ ] `docs/TYPESCRIPT_STRICTEST_PATTERNS.md` type safety
  - [ ] Server-first principles (Server Components default)
  - [ ] Progressive enhancement (forms work without JS)

**Decision Gates** (for vetted PRs):
- **Good + no issues** → Just mark as ready (Stage 3) - no separate stage needed
- **Good + issues** → Request changes (Stage 2)
- **Duplicate** → Already handled in tier 6 duplicate detection
- **Anti-pattern** → Close with explanation, document in `.jules/*.md`
- **Uncertain** → Tag `jules:manual-review`

---

## Stage 2: Request Changes

**When**: Initial review finds issues needing fixes

**Checklist**:
- [ ] Draft specific, actionable comments
  - Use clear language: "Change X to Y because Z"
  - Reference specific files and line numbers
  - Cite `NON_NEGOTIABLES.md` rules if violated
- [ ] Leave review comments on GitHub
- [ ] Set review status to "Request Changes" (NOT just "Comment")
- [ ] Apply label `jules:changes-requested`
- [ ] Record timestamp for 30-minute timeout

**Example Comment Format**:
```markdown
**Type Safety Issue** (CORE-TS-001):
Line 42: Using `any` violates project standards. Please use proper type guard instead.
See docs/TYPESCRIPT_STRICTEST_PATTERNS.md for pattern.

**Architecture Issue** (CORE-ARCH-001):
This should be a Server Component, not Client Component.
Remove "use client" and use Server Action for form submission.
```

**Wait for Jules** (Google's agent - app/google-labs-jules):
- Jules will acknowledge with 👀 emoji
- Jules will push commits addressing feedback
- If >30 minutes since last update (excluding 👀): label `jules:agent-stalled`

**After Jules Updates**:
- [ ] Review updated changes
- [ ] If satisfied → Mark as ready (Stage 3)
- [ ] If still issues → Iterate (add more comments)

---

## Stage 3: Mark Ready for Review

**When**: Draft changes validated and good to proceed

**Action**: Mark as ready and wait for Copilot to finish reviewing
```bash
gh pr ready <PR-number>
gh pr edit <PR-number> \
  --remove-label "jules:draft-review" \
  --remove-label "jules:changes-requested" \
  --remove-label "jules:copilot-comments" \
  --remove-label "jules:agent-stalled" \
  --add-label "jules:copilot-review"
```

**After marking ready**:

1. **Wait for Copilot to START reviewing**:
   ```bash
   # Poll timeline for Copilot review start (check every 30 seconds for up to 5 minutes)
   gh pr view <PR> --json timelineItems --jq '.timelineItems[] | select(.typename == "ReviewRequestedEvent" and .requestedReviewer.login == "copilot-pull-request-reviewer")'
   ```

2. **Wait for Copilot to FINISH reviewing**:
   ```bash
   # Check for completed review
   gh pr view <PR> --json reviews --jq '.reviews[] | select(.author.login == "copilot-pull-request-reviewer") | {state: .state, submitted: .submittedAt}'
   ```

3. **Only proceed to Stage 4 when**:
   - Copilot review exists (PullRequestReview event)
   - Review has state (COMMENTED, APPROVED, CHANGES_REQUESTED)
   - Review has submittedAt timestamp

**Timeout**: If Copilot hasn't reviewed within 10 minutes → Tag `jules:manual-review` for user decision

---

## Stage 4: Copilot Review Handling

**When**: Copilot has FINISHED reviewing (confirmed via timeline events from Stage 3)

**CRITICAL**: Wait for Copilot review to complete before checking for comments!

**Verify Copilot finished reviewing**:
```bash
# Verify Copilot finished reviewing
gh pr view <PR> --json reviews --jq '.reviews[] | select(.author.login == "copilot-pull-request-reviewer") | {state: .state, submitted: .submittedAt, id: .id}'
```

**CRITICAL**: GitHub Copilot (copilot-pull-request-reviewer) reviews are INVISIBLE to Jules (Google's agent)!

**Two separate systems**:
- **Copilot** = GitHub's AI code reviewer (copilot-pull-request-reviewer)
- **Jules** = Google's AI coding agent (app/google-labs-jules)
- They CANNOT see each other's comments!

**Checklist**:
- [ ] Verify Copilot finished reviewing (state + submittedAt exist)
- [ ] If Copilot left comments:
  - [ ] Get review ID from output
  - [ ] Retrieve comments:
    ```bash
    gh api repos/timothyfroehlich/PinPoint/pulls/<PR>/reviews/<review-id>/comments \
      --jq '.[] | {path, line, body}'
    ```
  - [ ] Repost EACH comment for Jules (see example below)
  - [ ] Apply label `jules:copilot-comments`
  - [ ] Record timestamp for 30-minute timeout
  - [ ] Wait for Jules to acknowledge (👀) and push updates
  - [ ] Review Jules's updates
  - [ ] If satisfied → Proceed to validation
  - [ ] If still issues → Iterate
  - [ ] If >30 min: label `jules:agent-stalled`

**Example Repost Format**:
```markdown
Copilot review comment on `src/app/schemas.ts:42`:

> Consider using a more restrictive max value (128) for password fields instead of 1000,
> as this aligns with common password policies and reduces DoS risk.

@google-labs-jules what do you think about this suggestion?
```

---

## Stage 5: Merge Conflict Resolution

**When**: PR has merge conflicts with main

**CRITICAL**: YOU (the orchestrating agent) handle merge conflicts - do NOT delegate to jules-pr-manager subagent or Jules

**Who handles conflicts**:
- ✅ **YOU (main agent)**: Run all git commands directly using Bash tool
- ❌ **NOT jules-pr-manager subagent**: Read-only, cannot modify working directory
- ❌ **NOT Jules**: Cannot handle merge conflicts reliably

**IMPORTANT**: Merge conflict resolution can be slow. Launch these as background tasks and continue processing other PRs while they work. Use `run_in_background=True` when launching conflict resolution tasks.

**Checklist**:
- [ ] Check for conflicts:
  ```bash
  gh pr view <PR> --json mergeable --jq '.mergeable'
  ```
- [ ] If conflicts exist:
  - [ ] Create temporary worktree in /tmp:
    ```bash
    PR_NUM=<PR-number>
    BRANCH=$(gh pr view $PR_NUM --json headRefName --jq '.headRefName')
    git worktree add /tmp/pinpoint-pr-$PR_NUM -b temp/pr-$PR_NUM
    cd /tmp/pinpoint-pr-$PR_NUM
    ```
  - [ ] Fetch PR branch and merge main:
    ```bash
    git fetch origin $BRANCH
    git merge origin/$BRANCH
    git fetch origin main
    git merge origin/main
    ```
  - [ ] Resolve conflicts manually:
    - **`.jules/*.md`**: Keep BOTH changes, merge chronologically:
      ```markdown
      ## 2025-02-14 - Earlier Entry
      ...

      ## 2025-12-19 - Newer Entry
      ...
      ```
    - **`supabase/seed-users.mjs`**: Merge both seed data sets
    - **`scripts/db-fast-reset.mjs`**: Merge both data sets
  - [ ] Commit and push resolved conflicts:
    ```bash
    git add .
    git commit -m "Resolve merge conflicts from main"
    git push origin HEAD:$BRANCH
    ```
    **Note**: Skip validation in temp worktree (no node_modules). CI will validate after push.
  - [ ] Cleanup worktree:
    ```bash
    cd /home/froeht/Code/PinPoint-Secondary
    git worktree remove /tmp/pinpoint-pr-$PR_NUM
    ```
  - [ ] Apply label `jules:merge-conflicts` → remove after resolved

---

## Stage 6: Pre-Merge Validation

**When**: All reviews satisfied, ready to merge

**Action**: Just run validation, then ask for merge confirmation - no separate stage label

**Validation Checklist**:
- [ ] All review comments addressed
- [ ] No merge conflicts
- [ ] CI checks passing:
  ```bash
  gh pr checks <PR>
  ```
- [ ] Changes align with project standards:
  - [ ] NON_NEGOTIABLES.md compliance
  - [ ] TYPESCRIPT_STRICTEST_PATTERNS.md compliance
  - [ ] Testing requirements met
- [ ] Review `.jules/*.md` journal updates:
  - [ ] Learning is documented
  - [ ] No merge conflicts in journal files
- [ ] Verify NOT a duplicate of merged PR

**If all pass** → Present merge confirmation (see Merge Confirmation section)

---

## Stage 7: Merge

**When**: User confirms merge (after seeing full context)

**Checklist**:
- [ ] Enable auto-merge:
  ```bash
  gh pr merge <PR> --auto --squash --delete-branch
  ```
- [ ] Verify merge successful
- [ ] Update local main:
  ```bash
  git checkout main && git pull origin main
  ```
- [ ] Monitor deployment

---

## 30-Minute Timeout Detection

**Trigger**: Jules (Google) or Copilot (GitHub) hasn't acted >30 min after OUR request (excluding 👀 acknowledgment)

**Note**: Jules and Copilot are separate systems:
- Jules acts via commits/comments as app/google-labs-jules
- Copilot acts via reviews as copilot-pull-request-reviewer

**CRITICAL**: Must check WHO acted last before applying timeout labels!

**Detection Process**:

1. **Get recent timeline events** (last 30 minutes to 24 hours):
```bash
# Get timeline events for PR (commits, comments, reviews)
gh pr view $PR_NUMBER --json timelineItems --jq '
  .timelineItems
  | reverse
  | .[]
  | select(.typename == "PullRequestCommit" or .typename == "IssueComment" or .typename == "PullRequestReview")
  | {
      type: .typename,
      author: (.author.login // .commit.author.name),
      created: (.createdAt // .commit.committedDate),
      message: (.body // .commit.message)[0:100]
    }
  | select(.created > "THRESHOLD_TIME")
'
```

2. **Determine WHO acted last**:
   - **If last event author = "timothyfroehlich"** (us) → We're waiting for Jules
   - **If last event author = "app/google-labs-jules"** (Jules bot) → Jules responded, we need to review!
   - **If last event typename = "PullRequestCommit"** → Check commit author

3. **Apply timeout logic ONLY if we acted last**:
```bash
# Pseudocode decision tree
last_actor=$(check_last_timeline_event)

if [ "$last_actor" == "timothyfroehlich" ]; then
  # We acted last - check if Jules is stalled
  time_since_our_action=$(calculate_time_diff)

  if [ $time_since_our_action -gt 1800 ]; then
    # Jules hasn't responded in 30+ min → STALLED
    gh pr edit $PR_NUMBER \
      --remove-label "jules:changes-requested" \
      --remove-label "jules:copilot-comments" \
      --add-label "jules:agent-stalled"
  fi

elif [ "$last_actor" == "app/google-labs-jules" ]; then
  # Jules acted last - ball is in OUR court!
  # Remove waiting labels, ready for our review
  gh pr edit $PR_NUMBER \
    --remove-label "jules:changes-requested" \
    --remove-label "jules:copilot-comments"

  # This PR needs our review now, not stalled
  echo "PR #$PR_NUMBER: Jules responded, ready for our review"
fi
```

**Commands** (use subagent since this requires 3+ steps):
```
Task(
    subagent_type="jules-pr-manager",
    description="Check timeout for PR #672",
    prompt="Check who acted last on PR #672:\n\n"
           "1. Get timeline events:\n"
           "   gh pr view 672 --json timelineItems --jq '.timelineItems | reverse | .[0:10] | .[] | select(.typename == \"PullRequestCommit\" or .typename == \"IssueComment\" or .typename == \"PullRequestReview\") | {type: .typename, author: (.author.login // .commit.author.name), created: (.createdAt // .commit.committedDate)}'\n\n"
           "2. Identify last actor (timothyfroehlich vs app/google-labs-jules)\n\n"
           "3. Calculate time since last event\n\n"
           "4. Report: Who acted last? How long ago?",
    run_in_background=True  # ✅ Always background
)
```

**Action if stalled**: Add to manual review queue, present to user

**Action if Jules responded**: Remove waiting labels, review Jules's changes

---

## Label Transitions After Jules Responds

**When Jules pushes commits** (detected via timeline events):

1. **Remove waiting labels** (use Bash directly - simple 1 command operation):
   ```bash
   # ✅ Use Bash tool directly for simple label operations
   gh pr edit $PR_NUMBER \
     --remove-label "jules:changes-requested" \
     --remove-label "jules:copilot-comments"
   ```

2. **Back to Stage 1 (Draft Review)**:
   - Re-review Jules's changes
   - Decision gates:
     - If satisfied → Mark ready (Stage 3)
     - If still issues → Request more changes (Stage 2)
     - If uncertain → Tag `jules:manual-review`

**When Copilot comments addressed** (Jules pushed commits after copilot-comments):

1. **Check CI status**:
   ```bash
   gh pr checks $PR_NUMBER
   ```

2. **Decision gates**:
   - **All CI passing** → Proceed to pre-merge validation (Stage 6)
   - **CI failing** → Post comment for Jules:
     ```markdown
     CI checks are failing. Please fix:
     - [List failing checks from gh pr checks output]

     @google-labs-jules please address these failures.
     ```
     Apply label `jules:changes-requested`

---

## Merge Confirmation with Full Context

**When**: PR ready to merge (all checks passed, conflicts resolved, reviews approved)

**Format** (assume user forgot all context):

```markdown
## Ready to Merge: PR #672

**Title**: 🛡️ Sentinel: [CRITICAL/HIGH] Fix Input Length Limits

**Type**: Security (Sentinel)

**What Changed**:
- Added `.max(100)` to `updateMachineSchema.name` (machine names)
- Added `.max(1000)` to `loginSchema.email` (login emails)
- Added `.max(128)` to `loginSchema.password` (passwords)
- Added `.max(1000)` to `forgotPasswordSchema.email` (password reset)

**Why**:
- Prevents DoS attacks via excessively long strings
- Complements earlier fix for issue descriptions/comments (#631)
- Catches auth and machine schemas missed in first pass

**Impact**:
- ✅ Blocks DoS via auth endpoints
- ✅ No breaking changes (limits are generous)
- ✅ Tests added and passing

**Files Modified**:
- `src/app/(app)/m/schemas.ts` (+1 line)
- `src/app/(auth)/schemas.ts` (+3 lines)
- `.jules/sentinel.md` (learning entry added)

**CI Status**: ✅ All checks passed

**Conflicts**: None

**Copilot Review**: Approved (no comments)

**Recommendation**: MERGE - Critical security fix, no risks identified

---

**Confirm auto-merge?** (y/n)
```

**User Response**: "y" or "n" (or explanation)

**If "n"**: Tag `jules:manual-review`, move to next PR

**If "y"**: Enable auto-merge, PR merges when CI completes

---

## Parallelization Strategy

Launch multiple jules-pr-manager subagent instances for data gathering, then analyze results sequentially.

### jules-pr-manager Subagent Configuration

**Configuration**: Defined in `.claude/agents/jules-pr-manager.md`

**Purpose**: Execute specific, read-only gh/git/bash commands

**Model**: Haiku (specified in subagent config)

**Tools**: Bash, Read, Glob, Grep only

**Read-Only Commands**:
- `gh pr view/list/diff/edit/ready/checks` - PR inspection and labeling
- `gh api` (GET requests only) - Read-only API queries
- `git show origin/branch:path` - Read files from PR branches without checkout
- `git merge-tree` - Check for conflicts without modifying working dir
- `jq` - Parse JSON output

**FORBIDDEN**: `git checkout`, `git merge`, `git reset`, `gh pr checkout` - Any command that modifies working directory

**REQUIRES CONFIRMATION**: `gh pr merge --auto`

### Example: Validate Multiple PRs in Parallel

```
# Launch jules-pr-manager subagents for 3 PRs in parallel
tasks = []
for pr_num in [672, 674, 661]:
    task = Task(
        subagent_type="jules-pr-manager",
        description=f"Get PR #{pr_num} data",
        prompt=f"Execute these commands for PR #{pr_num}:\n"
               f"1. gh pr view {pr_num} --json status,reviews,mergeable,headRefName,title --limit 1\n"
               f"2. gh pr diff {pr_num}\n"
               f"3. gh pr checks {pr_num}",
        run_in_background=True
    )
    tasks.append((pr_num, task))

# Collect results
results = {}
for pr_num, task in tasks:
    results[pr_num] = TaskOutput(task)

# Analyze and decide next steps (main agent makes ALL decisions)
for pr_num, data in results.items():
    if needs_copilot_comments_reposted(data):
        # Get review comments via another subagent
        review_task = Task(
            subagent_type="jules-pr-manager",
            description=f"Get Copilot review for #{pr_num}",
            prompt=f"Get Copilot review comments for PR #{pr_num}:\n"
                   f"1. gh pr view {pr_num} --json reviews\n"
                   f"2. Extract review ID from latest copilot-pull-request-reviewer review\n"
                   f"3. gh api repos/timothyfroehlich/PinPoint/pulls/{pr_num}/reviews/REVIEW_ID/comments"
        )
        review_data = TaskOutput(review_task)

        # Parse and repost comments (main agent decides content)
        for comment in parse_comments(review_data):
            Task(
                subagent_type="jules-pr-manager",
                prompt=f"Post comment on PR #{pr_num}:\n\n"
                       f"Copilot review comment on `{comment.path}:{comment.line}`:\n"
                       f"> {comment.body}\n\n"
                       f"@google-labs-jules please address this."
            )
```

### Reading Files from PR Branches (Without Checkout)

**Problem**: Need to inspect files from PR branch without modifying working directory

**Solution**: Use `git show` with remote branch references

```bash
# Get PR branch name
BRANCH=$(gh pr view 672 --json headRefName --jq '.headRefName')

# Read file from PR branch (no checkout!)
git show origin/$BRANCH:src/path/to/file.ts

# Check for merge conflicts (no working dir modification!)
git merge-tree $(git merge-base origin/main origin/$BRANCH) origin/main origin/$BRANCH
```

**Launch subagent for this**:
```
Task(
    subagent_type="jules-pr-manager",
    description="Read file from PR #672",
    prompt="Execute these commands:\n"
           "1. BRANCH=$(gh pr view 672 --json headRefName --jq '.headRefName')\n"
           "2. git show origin/$BRANCH:src/app/(auth)/schemas.ts"
)
```

---

## Common Scenarios

### Scenario 1: Repost Copilot Comments

```markdown
**Problem**: Copilot left 3 comments, Jules can't see them

**Solution** (requires 3+ commands, use subagent):
1. Launch subagent to get review ID and comments:
   Task(subagent_type="jules-pr-manager",
        prompt="1. gh pr view 672 --json reviews\n2. gh api repos/.../pulls/672/reviews/123/comments",
        run_in_background=True)
2. Repost each comment (use Bash directly - 1 command per comment):
   ```bash
   # ✅ Use Bash for simple comment posting
   gh pr comment 672 --body "Copilot comment on \`file.ts:42\`:\n> [text]\n\n@google-labs-jules please address this."
   ```
3. Apply label (use Bash directly - 1 command):
   ```bash
   # ✅ Use Bash for simple label operations
   gh pr edit 672 --add-label "jules:copilot-comments"
   ```
4. Wait for Jules (30min timeout)
```

### Scenario 2: Resolve `.jules/*.md` Conflict (Temporary Worktree)

```markdown
**Problem**: Both main and Jules PR updated `.jules/sentinel.md`

**Solution** (using temporary worktree):
1. Create temporary worktree in /tmp:
   ```bash
   git worktree add /tmp/pinpoint-pr-XXX -b temp/pr-XXX
   cd /tmp/pinpoint-pr-XXX
   ```
2. Fetch and merge PR branch:
   ```bash
   BRANCH=$(gh pr view XXX --json headRefName --jq '.headRefName')
   git fetch origin $BRANCH
   git merge origin/$BRANCH
   ```
3. Manually edit `.jules/sentinel.md`:
   - Keep BOTH entries
   - Order chronologically (earlier date first)
   ```markdown
   ## 2025-12-16 - Earlier Entry (from main)
   ...

   ## 2025-12-19 - Newer Entry (from Jules PR)
   ...
   ```
4. Commit and push:
   ```bash
   git add .jules/sentinel.md
   git commit -m "Resolve .jules/sentinel.md conflict (keep both entries)"
   git push origin HEAD:$BRANCH
   ```
   **Note**: Skip validation (no node_modules in temp worktree). CI validates after push.
5. Cleanup:
   ```bash
   cd /home/froeht/Code/PinPoint-Secondary
   git worktree remove /tmp/pinpoint-pr-XXX
   ```
6. Remove `jules:merge-conflicts` label (use Bash directly - simple 1 command):
   ```bash
   # ✅ Use Bash tool for simple label operations
   gh pr edit XXX --remove-label "jules:merge-conflicts"
   ```

**Note**: Always process merge conflicts sequentially (one at a time) and ask user if conflict is non-trivial.
```

### Scenario 3: Close Duplicate PRs

```markdown
**Problem**: PRs #665, #657, #654, #632 all address CopyButton

**Solution** (requires 4+ commands, use subagent for initial analysis):
1. Launch subagent to compare diffs and evaluate learning:
   Task(subagent_type="jules-pr-manager",
        prompt="1. gh pr diff 665 > pr665.diff\n2. gh pr diff 657 > pr657.diff\n...\n4. Compare diffs\n5. Read .jules/palette.md entries",
        run_in_background=True)
2. After analysis, post comment on winner (use Bash directly - 1 command):
   ```bash
   # ✅ Use Bash for simple comment posting
   gh pr comment 632 --body "Please also add from #665:\n\`\`\`typescript\n// Better tooltip...\n\`\`\`"
   ```
3. Close duplicates (use Bash directly - can do all in parallel):
   ```bash
   # ✅ Use Bash for simple PR operations
   gh pr close 665 --comment "Duplicate of #632" &
   gh pr close 657 --comment "Duplicate of #632" &
   gh pr close 654 --comment "Duplicate of #632" &
   wait
   ```
```

---

## Anti-Patterns

**DON'T**:
- Let Jules manage merge conflicts
- Assume Jules sees Copilot comments
- Merge duplicate PRs without consolidating valuable changes
- Skip validation because it's a bot
- Reference other PRs in comments (Jules can't read them)
- Ask about multiple PRs in same message during manual review
- Create separate stages for trivial actions (just do them)
- Use general-purpose subagents for Jules PR processing
- Modify working directory when inspecting PR branches
- Launch all subagents at once (use rolling window of 5)
- Process PRs without priority ordering (finish almost-done PRs first)
- **Wait for background tasks when you could be working on other PRs**
- **Block on tasks that could run in parallel (stay under 5 concurrent)**
- **Use subagents for simple 1-2 command operations (posting comments, applying labels)**
- **Launch subagents without `run_in_background=True`**

**DO**:
- Validate against NON_NEGOTIABLES.md
- Repost all Copilot comments verbatim
- Copy code explicitly when consolidating duplicates
- Handle merge conflicts ourselves in temporary worktrees
- Present manual review PRs ONE at a time with full context
- **Use Bash tool directly for simple 1-2 command operations (comments, labels)**
- **Use jules-pr-manager subagent ONLY for 3+ commands or long round-trips**
- **Always use `run_in_background=True` when launching subagents**
- Use rolling window of max 5 subagents (all non-blocking)
- Process PRs by priority tier (1, 2, 6, 3, 4, 5)
- Check for duplicates during vetting (tier 6 manual review)
- Run preflight before merge confirmation
- **Launch background tasks and continue working (maximum parallelism)**
- **Keep <5 concurrent tasks active at all times when work is available**

---

## Exit Criteria

**Skill is done when**:
- [ ] No open Jules PRs remain, OR
- [ ] All remaining PRs tagged `jules:manual-review` (waiting for user decisions), OR
- [ ] All remaining PRs waiting for Jules/Copilot with active labels (will check again in 5 minutes)

**PR is ready to merge when**:
- [ ] All Copilot comments addressed (reposted for Jules)
- [ ] All human comments addressed
- [ ] No merge conflicts
- [ ] CI passing
- [ ] Validated against NON_NEGOTIABLES.md
- [ ] No duplicate PRs open
- [ ] Jules acknowledged feedback (👀)
- [ ] User confirmed merge (after seeing full context)

---

## References

- **Jules Documentation**: https://jules.google.com/docs
- **Project Constraints**: `docs/NON_NEGOTIABLES.md`
- **Type Safety Patterns**: `docs/TYPESCRIPT_STRICTEST_PATTERNS.md`
- **Learning Journals**: `.jules/{sentinel,bolt,palette}.md`
- **GitHub Labels**: `gh label list --search "jules:"`

---

## Continuous Loop Implementation

**Pseudocode**:
```python
while True:
    # 1. Initialize
    all_prs = get_all_jules_prs()
    if not all_prs:
        print("✅ No open Jules PRs remaining!")
        break

    # 2. Check WHO acted last, apply timeout logic
    for pr in all_prs:
        last_actor = check_who_acted_last(pr)

        if last_actor == "timothyfroehlich":
            # We acted last - check if Jules/Copilot stalled
            if time_since_our_action(pr) > 1800:  # 30 min
                label_as_stalled(pr)

        elif last_actor == "app/google-labs-jules":
            # Jules acted last - ball in our court!
            remove_waiting_labels(pr)
            # PR goes back to draft review (Stage 1)

    # 3. Sort PRs by priority tier (NO separate duplicate detection stage)
    sorted_prs = []
    for pr in all_prs:
        tier = get_pr_tier(pr)  # Returns 1-7
        sorted_prs.append((tier, pr.created_at, pr))

    sorted_prs.sort()  # Sort by (tier, age)

    # Split into processable vs manual review
    processable = [pr for tier, _, pr in sorted_prs if tier <= 6 and not has_label(pr, "jules:manual-review")]
    manual = [pr for tier, _, pr in sorted_prs if has_label(pr, "jules:manual-review")]

    # 4. Launch parallel subagents (rolling window of 5)
    active_tasks = []
    pr_queue = processable.copy()

    # Launch initial batch (up to 5)
    while len(active_tasks) < 5 and pr_queue:
        pr = pr_queue.pop(0)
        task = launch_subagent_for_pr_data(pr, run_in_background=True)
        active_tasks.append((pr, task))

    # Process results as they complete
    all_results = []
    while active_tasks or pr_queue:
        # Wait for next task to complete
        completed_task = wait_for_next_completion(active_tasks)
        pr, result = completed_task
        all_results.append((pr, result))
        active_tasks.remove(completed_task)

        # Launch next PR in queue (rolling window)
        if pr_queue:
            next_pr = pr_queue.pop(0)
            task = launch_subagent_for_pr_data(next_pr, run_in_background=True)
            active_tasks.append((next_pr, task))

    # 5. Analyze results and execute actions
    for pr, data in all_results:
        analyze_and_execute_actions(pr, data)

    # 6. Async manual review (one at a time, includes duplicate detection for tier 6)
    for pr in manual:
        tier = get_pr_tier(pr)

        # Tier 6: Missing jules:vetted - check for duplicates first
        if tier == 6:
            # Run comprehensive duplicate detection
            duplicates = find_duplicates(pr, all_prs)
            if duplicates:
                winner = pick_best_pr([pr] + duplicates)
                consolidate_and_close_duplicates(winner, duplicates)
                if pr != winner:
                    continue  # Skip to next PR (this one was closed)

        # Present for manual review
        present_with_full_context(pr)
        wait_for_user_decision()
        handle_user_response(pr)

    # 7. Check completion - only sleep if ALL PRs are waiting
    remaining = get_all_jules_prs()
    if not remaining:
        break  # Done!

    # Check if ALL remaining PRs are waiting (via timeline check)
    all_waiting = True
    for pr in remaining:
        if not is_waiting_on_jules_or_copilot(pr):
            all_waiting = False
            break

    if all_waiting:
        print(f"All {len(remaining)} PRs waiting for Jules/Copilot. Checking again in 5 minutes...")
        sleep(300)  # 5 minutes
    else:
        print(f"Some PRs can be processed. Continuing to next iteration...")
        # Don't sleep, continue to next loop immediately
```
