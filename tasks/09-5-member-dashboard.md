# Task 9.5: Member Dashboard

**Status**: ⏳ PENDING
**Branch**: `feat/member-dashboard`
**Dependencies**: Task 9 (Comments System)

## Objective

Member dashboard with assigned issues, recent issues, unplayable machines, and quick stats.

## Acceptance Criteria

- [ ] Dashboard displays after login
- [ ] Assigned issues show correctly
- [ ] Recently reported issues show correctly
- [ ] Unplayable machines highlighted
- [ ] Quick stats display accurate counts
- [ ] All sections link to detail pages correctly
- [ ] Empty states display when no data
- [ ] Works on mobile (responsive design verified)
- [ ] All tests pass

## Tasks

### Dashboard Page

- [ ] Create/update `src/app/dashboard/page.tsx`
- [ ] Add auth guard (protected route)
- [ ] Query data:
  - Issues assigned to current user (with machine relation)
  - Recently reported issues (last 10, with machine and reporter)
  - Unplayable machines (machines with unplayable issues)
  - Stats:
    - Total open issues count
    - Machines needing service count (machines with open issues)
    - Issues assigned to me count

### Dashboard Layout

- [ ] Create card-based layout with shadcn Card
- [ ] Section: "Issues Assigned to Me"
  - List of assigned issues
  - Show title, severity, machine name
  - Link to issue detail
  - Empty state: "No issues assigned to you"
- [ ] Section: "Recently Reported Issues"
  - Last 10 issues reported
  - Show title, severity, machine, reporter
  - Link to issue detail
- [ ] Section: "Unplayable Machines"
  - List of machines with unplayable issues
  - Show machine name, issue count
  - Link to machine detail
  - Highlight with error color (critical attention needed)
- [ ] Section: "Quick Stats"
  - Card showing:
    - Open issues count
    - Machines needing service count
    - Issues assigned to me count

### Navigation Updates

- [ ] Update `src/components/layout/navigation.tsx`
  - "PinPoint" logo links to /dashboard for authenticated users
- [ ] Update login redirect to go to /dashboard
- [ ] Update signup redirect to go to /dashboard

### Pattern Documentation

- [ ] Update `docs/PATTERNS.md`
  - Dashboard query patterns
  - Card layout patterns
  - Stats calculation patterns

### Tests

- [ ] Integration tests for dashboard queries
- [ ] Integration test: Assigned issues query returns correct issues
- [ ] Integration test: Unplayable machines query correct
- [ ] Integration test: Stats calculation correct
- [ ] E2E test for dashboard display (critical journey #5)
  - Login as user
  - See dashboard with assigned issues
  - See recent issues
  - See stats

## Key Decisions

_To be filled during task execution_

## Problems Encountered

_To be filled during task execution_

## Lessons Learned

_To be filled during task execution_

## Updates for CLAUDE.md

_To be filled after completion - what future agents need to know_
