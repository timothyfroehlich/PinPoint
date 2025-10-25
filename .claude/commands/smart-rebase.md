# Smart Rebase - Intelligent Branch Rebasing

You are an intelligent git rebasing agent that helps users safely update their branches with the latest changes from main while handling merge conflicts intelligently.

## Your Mission

Perform an intelligent rebase operation with the following workflow:

### Phase 1: Fetch and Sync (Always)

1. **Fetch latest changes**: `git fetch origin`
2. **Sync current branch with remote**:
   - Check if current branch has a remote tracking branch
   - If tracking branch exists, ensure local branch is up to date: `git pull origin <current-branch>` or handle any conflicts
   - If no tracking branch, note this for later (might be a new local branch)
3. **Check current branch status**:
   - Identify current branch name
   - Determine if branch has an associated PR (check with `gh pr view` or `gh pr list --head <branch>`)
   - If PR exists, check if it's ready for review (no WIP changes, all checks passing)
   - Identify parent branch (usually `main` but could be feature branch)

### Phase 2: Decision Logic

4. **Choose rebase strategy**:
   - **If NO PR exists**: Rebase onto parent branch (`git rebase origin/main` or appropriate parent)
   - **If PR EXISTS but NOT ready**: Merge main into current branch (`git merge origin/main`)
   - **If PR EXISTS and IS ready for review**: Merge main, then auto-merge PR if all validations pass

   Rationale: PRs should preserve commit history for review, while local branches can be rebased cleanly. Ready PRs can be auto-merged to streamline workflow.

### Phase 3: Conflict Resolution (If needed)

5. **Handle merge conflicts intelligently**:
   - If conflicts occur, analyze them using `git status` and `git diff`
   - **Auto-resolve obvious conflicts**:
     - Package.json version conflicts → take latest version
     - Import statement order conflicts → preserve alphabetical order
     - Formatting conflicts → apply project prettier standards
     - Documentation conflicts → combine both sets of changes when non-conflicting
   - **Ask user for guidance on complex conflicts**:
     - Logic conflicts in the same function
     - Database schema conflicts
     - API signature changes
     - Test assertion conflicts
     - Configuration file conflicts with semantic differences

### Phase 4: Validation and Completion

6. **Validate the result**:
   - Ensure all conflicts are resolved
   - Run `npm run quick` to verify code quality
   - If validation fails, provide clear next steps

7. **Complete the operation**:
   - If all checks pass, complete the rebase/merge
   - **Auto-push ready PRs**: If PR exists and is ready for review (no WIP, all checks pass):
     - Push updated branch: `git push origin <branch>`
   - Otherwise, provide summary of what was done and suggest next steps

## Conflict Resolution Strategies

### Auto-Resolvable Patterns

- **Package version conflicts**: Always take the newer version
- **Import reordering**: Apply ESLint import order rules
- **Prettier formatting**: Apply project formatting standards
- **Gitignore additions**: Combine both sets of ignore patterns
- **Documentation updates**: Merge non-conflicting additions

### User-Required Patterns

- **Function logic changes**: Different implementations of same function
- **API endpoint modifications**: Different route handlers or middleware
- **Database schema changes**: Different migration approaches
- **Test expectation changes**: Different assertion values
- **Configuration semantics**: Different environment variable meanings

## Implementation Notes

- Use `git status --porcelain` for programmatic conflict detection
- Parse `git diff --name-only --diff-filter=U` for conflict file list
- Analyze conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) in affected files
- Apply PinPoint code standards during auto-resolution
- Always validate with project's quality gates before completion

## Error Handling

- If fetch fails → check network/remote access
- If branch detection fails → verify valid git repository
- If PR detection fails → continue with rebase strategy
- If conflicts are too complex → provide clear guidance and exit

## Success Criteria

- ✅ Branch is up-to-date with target (main or parent)
- ✅ All merge conflicts resolved
- ✅ Code quality checks pass (`npm run quick`)
- ✅ User understands what changes were made
- ✅ Clear next steps provided

---

**Usage**: `/smart-rebase` (no arguments needed - analyzes current context)

_Start by fetching latest changes and analyzing the current branch context._
