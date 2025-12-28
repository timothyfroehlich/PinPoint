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
   ├─ Scheduled: Sentinel (🛡️), Bolt (⚡), Palette (🎨)
   ├─ Individual tasks: Everything else
   └─ Manual review: Tagged jules:manual-review (skip for now)

4. Launch Parallel Subagents
   ├─ Pre-approved command subagent (persistent, auto-approve gh/git, confirm merge)
   ├─ 3 scheduled subagents (Sentinel/Bolt/Palette)
   └─ N individual task subagents (one per non-scheduled PR)

5. Wait for Subagent Completion
   ├─ Collect results from all subagents
   └─ Identify PRs needing manual review

6. Async Manual Review (one at a time)
   ├─ Launch async subagent for first manual review PR
   ├─ Present full context (assume user forgot)
   ├─ Wait for user response
   ├─ Respond to subagent
   └─ Move to next manual review PR

7. Check for Completion
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

## Parallelization: Subagent Strategy

### Pre-Approved Command Subagent (persistent)

**Configuration**: Defined in `.claude/agents/jules-pr-manager.md`

**Purpose**: Execute gh/git/bash commands without permission friction

**Model**: Haiku (specified in subagent config)

**Tools**: Bash, Read, Glob, Grep only

**Auto-approved**:
- `gh pr view/list/diff/edit/ready/checks`
- `git merge`, `git commit`, `git push`
- Label updates, conflict resolution
- `gh api` (read-only queries)
- `jq` for JSON parsing

**REQUIRES CONFIRMATION**: `gh pr merge --auto`

**How to Invoke**:
```markdown
Use the jules-pr-manager subagent to check PR status for #672
Use the jules-pr-manager subagent to mark PR #672 as ready
Use the jules-pr-manager subagent to apply label jules:copilot-review to PR #672
```

**Note**: Simply reference the subagent by name in your prompt. Claude Code will automatically load the configuration from `.claude/agents/jules-pr-manager.md` and use Haiku model with restricted tools.

### Scheduled PR Subagents (3 parallel)

**Sentinel Subagent**: All 🛡️ security PRs
**Bolt Subagent**: All ⚡ performance PRs
**Palette Subagent**: All 🎨 accessibility/UX PRs

**Each processes**:
- Draft review
- Conflict resolution
- Copilot comment reposting
- Label updates

**Filters out**: `jules:manual-review` PRs (handled separately)

**Launch**:
```
sentinels = [pr for pr in all_prs if "🛡️" in pr.title and "jules:manual-review" not in pr.labels]
Task(subagent_type="general-purpose", description="Process Sentinel PRs", prompt=f"Process these Sentinel PRs: {sentinels}", run_in_background=True)

# Same for Bolt (⚡) and Palette (🎨)
```

### Individual Task PR Subagents (N parallel)

**Purpose**: Handle non-scheduled Jules PRs (user-initiated tasks)

**Pattern**: One subagent per PR (tasks are very different)

**Launch**:
```
individual_prs = [pr for pr in all_prs if no_emoji(pr.title) and "jules:manual-review" not in pr.labels]
for pr in individual_prs:
    Task(
        subagent_type="general-purpose",
        description=f"Process PR {pr.number}",
        prompt=f"Process individual Jules PR #{pr.number}: {pr.title}",
        run_in_background=True
    )
```

### Async Manual Review Subagents (serial, one at a time)

**Purpose**: Present PRs needing manual decisions

**Pattern**: Present PR #1 → wait → respond → PR #2 → ...

**CRITICAL**: ONE at a time (never ask about multiple PRs in same message)

**Launch**:
```
manual_prs = [pr for pr in all_prs if "jules:manual-review" in pr.labels]
for pr in manual_prs:
    task = Task(
        subagent_type="general-purpose",
        description=f"Present PR {pr.number} for manual review",
        prompt=f"Present PR #{pr.number} for manual review with full context (assume user forgot)",
        run_in_background=True
    )
    # Present to user, wait for response
    # Respond to subagent
    # Move to next
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

### Scenario 2: Handle CHANGELOG Conflict

```markdown
**Problem**: Jules PR has CHANGELOG conflict with main

**Solution**:
1. Checkout PR branch
2. Merge main: `git merge origin/main`
3. Resolve conflict: Keep main's version (Jules exempt)
   ```bash
   git checkout --theirs CHANGELOG.md
   ```
4. Push: `git push`
5. Remove `jules:merge-conflicts` label
```

### Scenario 3: Resolve `.jules/*.md` Conflict

```markdown
**Problem**: Both main and Jules PR updated `.jules/sentinel.md`

**Solution**:
1. Checkout PR branch
2. Merge main: `git merge origin/main`
3. Manually edit `.jules/sentinel.md`:
   - Keep BOTH entries
   - Order chronologically (earlier date first)
   ```markdown
   ## 2025-12-16 - Earlier Entry (from main)
   ...

   ## 2025-12-19 - Newer Entry (from Jules PR)
   ...
   ```
4. Push: `git push`
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

**DO**:
- Validate against NON_NEGOTIABLES.md
- Repost all Copilot comments verbatim
- Copy code explicitly when consolidating duplicates
- Handle merge conflicts ourselves
- Present manual review PRs ONE at a time with full context
- Run preflight before merge confirmation
- Use the pre-approved command subagent for routine operations

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
