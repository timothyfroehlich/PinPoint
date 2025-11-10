# Task 8: Issues Per Machine

**Status**: ⏳ PENDING
**Branch**: `feat/issues-system`
**Dependencies**: Task 7 (Machines CRUD)

## Objective

Issue CRUD with machine requirement, status/severity management, timeline events, and filtering.

## Acceptance Criteria

- [ ] Can view issues for a machine
- [ ] Can create new issue for machine
- [ ] Can view issue details
- [ ] Can update issue status
- [ ] Can update issue severity
- [ ] Can assign issue to user
- [ ] Timeline events created for all updates
- [ ] Timeline displays system events and comments together
- [ ] CHECK constraint prevents issues without machines
- [ ] Works on mobile (responsive design verified)
- [ ] All tests pass

## Tasks

### Issue List Page

- [ ] Create `src/app/machines/[machineId]/issues/page.tsx`
- [ ] Add auth guard
- [ ] Query issues for machine with relations
  - Include assigned user, reporter
  - Order by created_at desc
- [ ] Display issues with severity badges
- [ ] Show status for each issue
- [ ] Add "Create Issue" button
- [ ] Add filters (REQUIRED per PRODUCT_SPEC):
  - Filter by status (new/in_progress/resolved)
  - Filter by severity (minor/playable/unplayable)
  - Filter by assignee (dropdown of members)

### Create Issue Form

- [ ] Create `src/app/machines/[machineId]/issues/actions.ts`
- [ ] Create Server Action for issue creation
  - Validate machineId is present (CORE-ARCH-004)
  - Zod schema with severity enum ('minor' | 'playable' | 'unplayable') (CORE-SEC-002)
  - Auth check for reported_by (CORE-SEC-001)
  - Database insert with Drizzle
  - Revalidate path
- [ ] Create `src/app/machines/[machineId]/issues/new/page.tsx`
- [ ] Create form component
  - Title input (required)
  - Description textarea
  - Severity selector (minor/playable/unplayable)
  - Machine is implicit from URL
  - Progressive enhancement
- [ ] Update `docs/PATTERNS.md` with issues-per-machine pattern

### Issue Detail Page

- [ ] Create `src/app/issues/[issueId]/page.tsx`
- [ ] Add auth guard
- [ ] Query issue with relations (machine, reporter, assignee)
- [ ] Query issue comments (including system comments for timeline)
- [ ] Display issue details
  - Title, description
  - Severity badge
  - Status badge
  - Reporter, assignee
  - Created/updated/resolved timestamps
- [ ] Show related machine (link back)
- [ ] Display timeline (system comments + regular comments)
- [ ] Display current status and severity
- [ ] Add update status action (dropdown or buttons)
- [ ] Add update severity action
- [ ] Add assign to user action (dropdown)

### Issue Update Actions

- [ ] Create `src/app/issues/[issueId]/actions.ts`
- [ ] Update status action (Zod validation, auth check)
  - Create timeline event: "Status changed from {old} to {new}"
- [ ] Update severity action
  - Create timeline event: "Severity changed from {old} to {new}"
- [ ] Update assigned user action
  - Create timeline event: "Assigned to {user}"
- [ ] Resolve issue action (sets resolved_at timestamp)
  - Create timeline event: "Marked as resolved"

### Timeline System Events

- [ ] Create `src/lib/timeline/events.ts`
  - `createTimelineEvent(issueId, content)` helper
  - Inserts issue_comment with `is_system: true`
- [ ] Integrate timeline events into all update actions
- [ ] Display timeline in issue detail page
  - System comments styled differently (icon, muted text)
  - Regular comments styled normally

### Tests

- [ ] Unit tests for issue validation schemas
- [ ] Integration tests for issue queries
- [ ] Integration tests for issue mutations
- [ ] Integration test: Status change creates system comment
- [ ] Integration test: Assignment creates system comment
- [ ] E2E test for create issue flow
- [ ] E2E test for update issue status flow
- [ ] Test CHECK constraint (issues require machine)
  - Try to insert issue without machine_id (should fail)

## Key Decisions

_To be filled during task execution_

## Problems Encountered

_To be filled during task execution_

## Lessons Learned

_To be filled during task execution_

## Updates for CLAUDE.md

_To be filled after completion - what future agents need to know_
