# Task 8.5: Public Issue Reporting

**Status**: ⏳ PENDING
**Branch**: `feat/public-reporting`
**Dependencies**: Task 8 (Issues Per Machine)

## Objective

Anonymous public issue reporting form (no authentication required) for community members.

## Acceptance Criteria

- [ ] Unauthenticated users can access /report
- [ ] Can select machine from dropdown
- [ ] Can submit issue without login
- [ ] Confirmation page displays after submission
- [ ] Issue appears in member dashboard with NULL reporter
- [ ] Works on mobile (responsive design verified)
- [ ] All tests pass

## Tasks

### Public Reporting Page

- [ ] Create `src/app/report/page.tsx` (public route, no auth guard)
- [ ] Query all machines (public can see machine list)
- [ ] Display simple form:
  - Machine dropdown (required)
  - Title input (required)
  - Description textarea
  - Severity selector (minor/playable/unplayable)
  - Progressive enhancement
- [ ] Use clear, friendly language for public users
  - "Report an Issue with a Pinball Machine"
  - Severity descriptions: "Minor (cosmetic)", "Playable (but needs attention)", "Unplayable (machine is down)"

### Public Reporting Server Action

- [ ] Create `src/app/report/actions.ts`
- [ ] Create Server Action for anonymous reporting
  - Zod validation (machine_id, title required, severity enum) (CORE-SEC-002)
  - NO auth check (anonymous reporting)
  - Set `reported_by` to NULL
  - Database insert with Drizzle
  - Revalidate paths
  - Redirect to confirmation page
- [ ] Add rate limiting consideration (document for future if abused)

### Confirmation Page

- [ ] Create `src/app/report/success/page.tsx`
- [ ] Display confirmation message
  - "Thank you for reporting this issue!"
  - "Our team has been notified and will address it soon."
  - Link back to report another issue

### Navigation Update

- [ ] Add "Report Issue" link to unauthenticated navigation
  - Place next to Sign In/Sign Up buttons

### Tests

- [ ] Integration test for anonymous issue creation
- [ ] Integration test: Anonymous issues have NULL reported_by
- [ ] Integration test: Anonymous issues appear in member issue lists
- [ ] E2E test for public issue reporting flow
  - Navigate to /report
  - Select machine, fill form, submit
  - See confirmation page
- [ ] Verify anonymous issues appear in authenticated views

## Key Decisions

_To be filled during task execution_

## Problems Encountered

_To be filled during task execution_

## Lessons Learned

_To be filled during task execution_

## Updates for CLAUDE.md

_To be filled after completion - what future agents need to know_
