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
3. **Merge conflict handling** - we handle them, not Jules
4. **CHANGELOG exempt** - Jules PRs skip release notes (workflow already exempts `jules[bot]`)

**Learning Journals**: Jules maintains `.jules/{sentinel,bolt,palette}.md` with findings/learnings

---

## Execution Model

**Continuous Loop**: Runs until NO open Jules PRs remain (doesn't exit when waiting for agents)

**Batch Processing**: Each invocation processes ALL open Jules PRs

**Stage Advancement**: Automatically performs trivial actions (mark ready, apply labels)

**Parallelization**:
- Scheduled PRs (Sentinel/Bolt/Palette): Type-specific subagents
- Individual task PRs: One subagent per PR (very different from each other)
- Manual review: Async subagents, present ONE at a time

**30-Minute Timeout**: If Jules/Copilot hasn't acted >30min (excluding 👀), label as `jules:agent-stalled`

---

## Orchestration Pattern

**YOU (the main agent) orchestrate the workflow. The jules-pr-manager subagent is your command executor.**

### Correct Pattern ✅

The main agent (YOU) makes all decisions based on the skill workflow. You launch jules-pr-manager subagent instances for specific, read-only tasks.

**Example: Validate PR in parallel**
```
# Step 1: Launch jules-pr-manager subagents in parallel for data gathering
pr_672_task = Task(
    subagent_type="jules-pr-manager",
    description="Get PR #672 status",
    prompt="Execute these commands for PR #672:\n"
           "1. gh pr view 672 --json status,reviews,mergeable,headRefName\n"
           "2. gh pr diff 672\n"
           "3. gh pr checks 672",
    run_in_background=True
)

pr_674_task = Task(
    subagent_type="jules-pr-manager",
    description="Get PR #674 status",
    prompt="Execute these commands for PR #674:\n"
           "1. gh pr view 674 --json status,reviews,mergeable,headRefName\n"
           "2. gh pr diff 674",
    run_in_background=True
)

# Step 2: Wait for results
pr_672_data = TaskOutput(pr_672_task)
pr_674_data = TaskOutput(pr_674_task)

# Step 3: Analyze and decide (main agent makes decisions!)
if copilot_comments_found_in(pr_672_data):
    # Launch another subagent to post comments
    Task(
        subagent_type="jules-pr-manager",
        prompt="Post comment on PR #672:\n\nCopilot review comment on `file.ts:42`:\n> [comment text]\n\n@google-labs-jules please address this."
    )
```

**Key Principles**:
- Main agent sees skill content, understands full workflow
- Main agent decides WHAT to do based on workflow stages
- jules-pr-manager subagent executes HOW (specific gh/git commands)
- Subagent is read-only: uses `git show`, `git merge-tree`, never modifies working dir
- Parallelization via multiple subagent instances for data gathering
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

---

## Workflow: Continuous Processing Loop

```
1. Initialize
   ├─ List all open Jules PRs
   ├─ Apply 30-minute timeout checks → label stalled PRs
   └─ Detect duplicates

2. Duplicate Detection (first pass)
   ├─ Group PRs by similar titles/issue
   ├─ Compare diffs (gh pr diff)
   ├─ Evaluate .jules/*.md entries (pick better learning)
   ├─ Comment on winner with EXPLICIT code from losers (Jules can't read other PRs)
   └─ Close losers

3. Categorize PRs
   ├─ By type: Sentinel (🛡️), Bolt (⚡), Palette (🎨), Individual tasks
   └─ By status: Ready to process vs. Manual review needed

4. Launch jules-pr-manager Subagents (Parallel Data Gathering)
   ├─ One subagent per PR for status/diff/checks
   ├─ Wait for results via TaskOutput
   └─ Collect all data before making decisions

5. Analyze Results & Make Decisions (Main Agent)
   ├─ Evaluate each PR based on workflow stages
   ├─ Decide which actions to take (comment, label, merge conflicts, etc.)
   └─ Identify PRs needing manual review

6. Execute Actions via jules-pr-manager Subagents
   ├─ Launch subagents for specific actions (post comments, apply labels)
   ├─ Handle merge conflicts in temporary worktrees
   └─ Wait for completion

7. Manual Review (one at a time)
   ├─ Present first manual review PR with full context
   ├─ Wait for user decision
   ├─ Execute user's decision via jules-pr-manager subagent
   └─ Move to next manual review PR

8. Check for Completion
   ├─ No open PRs remain → DONE
   ├─ Waiting for Jules/Copilot (labeled) → Sleep 5 min, loop to step 1
   └─ Stalled PRs (30+ min) → Add to manual review queue
```

---

## Stage 1: Initial Draft Review

**When**: Jules creates draft PR (`isDraft: true`)

**Checklist**:
- [ ] Identify PR type from title emoji (🛡️/⚡/🎨)
- [ ] Check for duplicates:
  ```bash
  gh pr list --search "author:app/google-labs-jules is:open [search-term]" --limit 20
  ```
- [ ] Read PR description and understand changes
- [ ] Review changed files - are changes good/worth making?
- [ ] Validate against project standards:
  - [ ] `docs/NON_NEGOTIABLES.md` compliance
  - [ ] `docs/TYPESCRIPT_STRICTEST_PATTERNS.md` type safety
  - [ ] Server-first principles (Server Components default)
  - [ ] Progressive enhancement (forms work without JS)

**Decision Gates**:
- **Good + no issues** → Just mark as ready (Stage 3) - no separate stage needed
- **Good + issues** → Request changes (Stage 2)
- **Duplicate** → Handle via duplicate detection flow
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

**Wait for Jules**:
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

**Action**: Just do it - no separate stage needed
```bash
gh pr ready <PR-number>
gh pr edit <PR-number> --remove-label "jules:draft-review" --add-label "jules:copilot-review"
```

**Next**: Copilot will automatically review (usually within minutes)

---

## Stage 4: Copilot Review Handling

**When**: Copilot reviews PR and may leave comments

**CRITICAL**: Copilot comments are INVISIBLE to Jules - must repost them manually!

**Checklist**:
- [ ] Check if Copilot reviewed:
  ```bash
  gh pr view <PR> --json reviews --jq '.reviews[] | select(.author.login == "copilot-pull-request-reviewer")'
  ```
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

**CRITICAL**: Do NOT let Jules manage merge conflicts - handle ourselves

**Checklist**:
- [ ] Check for conflicts:
  ```bash
  gh pr view <PR> --json mergeable --jq '.mergeable'
  ```
- [ ] If conflicts exist:
  - [ ] Checkout PR branch:
    ```bash
    gh pr checkout <PR>
    ```
  - [ ] Merge main into branch:
    ```bash
    git fetch origin main && git merge origin/main
    ```
  - [ ] Resolve conflicts manually:
    - **CHANGELOG.md**: Keep main's version (Jules exempt, can drop their entry)
    - **`.jules/*.md`**: Keep BOTH changes, merge chronologically:
      ```markdown
      ## 2025-02-14 - Earlier Entry
      ...

      ## 2025-12-19 - Newer Entry
      ...
      ```
    - **`supabase/seed-users.mjs`**: Merge both seed data sets
    - **`scripts/db-fast-reset.mjs`**: Merge both data sets
  - [ ] Run validation:
    ```bash
    npm run preflight
    ```
  - [ ] Push resolved conflicts:
    ```bash
    git push
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

## Duplicate Detection & Smart Consolidation

**Problem**: Jules creates 5+ attempts on same issue

**Process**:
1. **Identify duplicates**: PRs with similar titles/descriptions
2. **Compare diffs**:
   ```bash
   gh pr diff <PR1> > pr1.diff
   gh pr diff <PR2> > pr2.diff
   diff -u pr1.diff pr2.diff
   ```
3. **Evaluate `.jules/*.md` entries**: Pick PR with better learning documentation (primary criterion)
4. **Pick winner**:
   - Better `.jules/*.md` learning entry (MOST IMPORTANT)
   - More complete implementation
   - Better test coverage
   - More recent (tiebreaker)

5. **Comment on winner with EXPLICIT code** (Jules can't read other PRs):

```markdown
This PR is the keeper. Please incorporate these improvements from #XXX:

**From `src/app/schemas.ts` (line 42):**
```typescript
// Better error message
.max(128, "Password must be 128 characters or less for security")
```

**From `src/test/schemas.test.ts` (new test case):**
```typescript
test("password rejects 129+ characters", () => {
  const longPassword = "a".repeat(129);
  const result = schema.safeParse({ password: longPassword });
  expect(result.success).toBe(false);
});
```

@google-labs-jules please add these exact changes.
```

6. **Close losers**:
```bash
gh pr close <PR> --comment "Closing as duplicate of #<winner> which has better implementation. Valuable changes noted in #<winner> for incorporation."
```

---

## 30-Minute Timeout Detection

**Trigger**: Jules/Copilot hasn't acted >30 min after request (excluding 👀 acknowledgment)

**Detection**:
```bash
# Check if PR updated in last 30 minutes
last_updated=$(gh pr view $PR_NUMBER --json updatedAt --jq '.updatedAt')
current_time=$(date -u +%s)
updated_time=$(date -d "$last_updated" +%s)
time_diff=$((current_time - updated_time))

if [ $time_diff -gt 1800 ]; then
  # Stalled for >30 minutes
  gh pr edit $PR_NUMBER \
    --remove-label "jules:changes-requested" \
    --remove-label "jules:copilot-comments" \
    --add-label "jules:agent-stalled"
fi
```

**Action**: Add to manual review queue, present to user

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

**Solution**:
1. Get review ID: `gh pr view 672 --json reviews`
2. Get comments: `gh api repos/.../pulls/672/reviews/123/comments`
3. Repost each comment:
   ```
   Copilot comment on `file.ts:42`:
   > [Copilot's comment text]

   @google-labs-jules please address this.
   ```
4. Apply `jules:copilot-comments` label
5. Wait for Jules (30min timeout)
```

### Scenario 2: Handle CHANGELOG Conflict (Temporary Worktree)

```markdown
**Problem**: Jules PR has CHANGELOG conflict with main

**Solution** (using temporary worktree to avoid modifying main working directory):
1. Create temporary worktree:
   ```bash
   git worktree add ../temp-pr-XXX -b temp/pr-XXX
   cd ../temp-pr-XXX
   ```
2. Fetch and merge PR branch:
   ```bash
   BRANCH=$(gh pr view XXX --json headRefName --jq '.headRefName')
   git fetch origin $BRANCH
   git merge origin/$BRANCH
   ```
3. Resolve conflict: Keep main's version (Jules exempt)
   ```bash
   git checkout --theirs CHANGELOG.md
   git add CHANGELOG.md
   git commit -m "Resolve CHANGELOG conflict (Jules exempt)"
   ```
4. Push to PR branch:
   ```bash
   git push origin HEAD:$BRANCH
   ```
5. Cleanup:
   ```bash
   cd /home/froeht/Code/PinPoint-Secondary
   git worktree remove ../temp-pr-XXX
   ```
6. Remove `jules:merge-conflicts` label via jules-pr-manager subagent
```

### Scenario 3: Resolve `.jules/*.md` Conflict (Temporary Worktree)

```markdown
**Problem**: Both main and Jules PR updated `.jules/sentinel.md`

**Solution** (using temporary worktree):
1. Create temporary worktree:
   ```bash
   git worktree add ../temp-pr-XXX -b temp/pr-XXX
   cd ../temp-pr-XXX
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
5. Cleanup:
   ```bash
   cd /home/froeht/Code/PinPoint-Secondary
   git worktree remove ../temp-pr-XXX
   ```
6. Remove `jules:merge-conflicts` label via jules-pr-manager subagent

**Note**: Always process merge conflicts sequentially (one at a time) and ask user if conflict is non-trivial.
```

### Scenario 4: Close Duplicate PRs

```markdown
**Problem**: PRs #665, #657, #654, #632 all address CopyButton

**Solution**:
1. Compare diffs: `gh pr diff 665 657 654 632`
2. Evaluate `.jules/palette.md` entries (pick best learning)
3. Winner: #632 (better learning documentation)
4. Comment on #632 with code from others:
   ```markdown
   Please also add from #665:
   ```typescript
   // Better tooltip text
   <Tooltip><TooltipContent>Link copied to clipboard</TooltipContent></Tooltip>
   ```
   ```
5. Close #665, #657, #654:
   ```bash
   gh pr close 665 657 654 --comment "Duplicate of #632"
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

**DO**:
- Validate against NON_NEGOTIABLES.md
- Repost all Copilot comments verbatim
- Copy code explicitly when consolidating duplicates
- Handle merge conflicts ourselves in temporary worktrees
- Present manual review PRs ONE at a time with full context
- Use jules-pr-manager subagent for specific, read-only commands
- Launch subagents in parallel for data gathering, analyze results sequentially
- Run preflight before merge confirmation

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

    # 2. Timeout check
    for pr in all_prs:
        if is_stalled(pr, timeout_minutes=30):
            label_as_stalled(pr)

    # 3. Duplicate detection
    handle_duplicates(all_prs)

    # 4. Categorize
    scheduled = categorize_scheduled(all_prs)  # Sentinel/Bolt/Palette
    individual = categorize_individual(all_prs)  # Non-scheduled
    manual = get_manual_review(all_prs)

    # 5. Launch parallel subagents
    cmd_agent = launch_command_subagent()
    for pr_type, prs in scheduled.items():
        launch_subagent(pr_type, prs)
    for pr in individual:
        launch_subagent(f"individual_{pr.number}", [pr])

    # 6. Wait for completion
    wait_for_all_subagents()

    # 7. Async manual review (one at a time)
    for pr in manual:
        present_with_full_context(pr)
        wait_for_user_decision()
        handle_user_response(pr)

    # 8. Check completion
    remaining = get_all_jules_prs()
    waiting = [pr for pr in remaining if has_waiting_label(pr)]

    if not remaining:
        break  # Done!
    elif waiting:
        print(f"Waiting for Jules/Copilot on {len(waiting)} PRs. Checking again in 5 minutes...")
        sleep(300)  # 5 minutes
        continue
    else:
        print("All PRs processed. Manual review required for remaining.")
        break
```
