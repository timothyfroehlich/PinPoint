# Task 9: Comments System

**Status**: ⏳ PENDING
**Branch**: `feat/issue-comments`
**Dependencies**: Task 8.5 (Public Issue Reporting)

## Objective

Add comments to issues (regular user comments, separate from system timeline events).

## Acceptance Criteria

- [ ] Can view comments on issue
- [ ] Can add new comment
- [ ] Comments display with author and timestamp
- [ ] Comments separate from timeline events
- [ ] Anonymous issues can receive comments from authenticated users
- [ ] Works on mobile (responsive design verified)
- [ ] All tests pass

## Tasks

### Comments Display

- [ ] Update `src/app/issues/[issueId]/page.tsx`
- [ ] Query comments for issue (with author relation)
  - Filter for `is_system: false` (regular comments only)
  - Timeline system comments already displayed separately
- [ ] Display comments list
  - Author name (or "Anonymous" if NULL)
  - Avatar (if available)
  - Timestamp
  - Content
- [ ] Order comments by created_at asc (chronological)

### Add Comment Form

- [ ] Update `src/app/issues/[issueId]/actions.ts`
- [ ] Create Server Action for adding comments
  - Zod validation (content required, min length 1) (CORE-SEC-002)
  - Auth check for author_id (CORE-SEC-001)
  - Set `is_system: false`
  - Database insert with Drizzle
  - Revalidate path
- [ ] Add comment form to issue detail page
  - Textarea for comment content
  - Progressive enhancement
  - Submit button
- [ ] Display validation errors

### Tests

- [ ] Unit tests for comment validation
- [ ] Integration tests for comment queries
- [ ] Integration tests for comment creation
- [ ] Integration test: Comments have is_system: false
- [ ] Integration test: Comments separate from timeline events
- [ ] E2E test for add comment flow

## Key Decisions

_To be filled during task execution_

## Problems Encountered

_To be filled during task execution_

## Lessons Learned

_To be filled during task execution_

## Updates for CLAUDE.md

_To be filled after completion - what future agents need to know_
