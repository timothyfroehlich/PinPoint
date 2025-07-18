# Task: Review Agent - Issue Detail Page

## Mission Statement

Review the PR for the Issue Detail page rebuild, ensure code quality, address review comments (including GitHub Copilot), and set the PR to auto-merge when all checks pass.

## Context

- Implementation agent has created a PR with passing tests
- Need to review for code quality, patterns, and completeness
- Address any automated review comments
- Ensure PR meets all project standards

## Review Steps

### 1. Initial PR Review

Check the PR on GitHub:

```bash
gh pr view --web
```

Review checklist:

- [ ] All CI checks passing (tests, lint, typecheck)
- [ ] No TypeScript errors or `any` types
- [ ] Code follows project patterns
- [ ] Tests provide good coverage
- [ ] Playwright tests are comprehensive

### 2. Code Quality Review

#### Component Structure

- Proper separation of server/client components
- Reusable component design
- Clean prop interfaces
- Proper error boundaries

#### State Management

- Optimistic updates implemented correctly
- Error states handled gracefully
- Loading states present
- No unnecessary re-renders

#### Permissions

- All permission checks in place
- Tooltips show correct messages
- Disabled states implemented
- No security vulnerabilities

#### Performance

- Images optimized
- Lazy loading where appropriate
- No N+1 queries
- Efficient data fetching

### 3. GitHub Copilot Review

Request and review Copilot feedback:

```bash
gh pr review --request-copilot
```

Common Copilot suggestions to check:

- Security vulnerabilities
- Performance improvements
- Code simplification
- Missing error handling
- Accessibility issues

### 4. Manual Testing Verification

While implementation agent ran tests, verify:

- [ ] Issue detail loads for public users
- [ ] Authentication flow works correctly
- [ ] Permission-based UI elements show/hide properly
- [ ] Status changes work with proper activity logging
- [ ] Comments can be added and display correctly
- [ ] Mobile layout is responsive
- [ ] Accessibility (keyboard navigation, screen readers)

### 5. Documentation Check

Ensure updates to:

- [ ] Component documentation (if needed)
- [ ] Any API changes documented
- [ ] Architecture maps updated if structure changed

### 6. Address Review Comments

For each comment:

1. Understand the feedback
2. Implement the change
3. Test the change
4. Respond to the comment
5. Mark as resolved

### 7. Final Validation

Before marking ready:

```bash
npm run validate
npm run test
npx playwright test
npm run pre-commit
```

### 8. Set Auto-merge

Once all reviews are addressed:

```bash
gh pr merge --auto --squash
```

## Success Criteria

- [ ] All CI checks remain green
- [ ] All review comments addressed
- [ ] Copilot review completed and addressed
- [ ] Manual testing confirms functionality
- [ ] PR set to auto-merge
- [ ] No degradation in code quality
- [ ] Follows all project patterns

## Common Review Issues

- Missing loading states
- Inadequate error handling
- Permission checks too permissive
- Not following service factory pattern
- Direct database access
- Missing test cases
- Accessibility violations
- Mobile layout issues

## Quality Standards

From CLAUDE.md:

- 0 TypeScript errors
- 0 usage of `any` type
- 0 ESLint errors
- Consistent formatting
- Modern patterns (ES modules, typed mocks)
- Test quality same as production code

## Completion Instructions

When your task is complete:

1. Ensure all review comments are resolved
2. Verify CI is still green
3. Confirm auto-merge is enabled
4. Comment on PR: "All reviews addressed, set to auto-merge"
5. Monitor until merge completes
6. Verify main branch builds successfully post-merge
7. Notify the orchestrator - DO NOT clean up the worktree yourself
