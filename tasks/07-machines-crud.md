# Task 7: Machines CRUD

**Status**: ⏳ PENDING
**Branch**: `feat/machines-crud`
**Dependencies**: Task 6.5 (Navigation Framework)

## Objective

Complete CRUD for machines (list, create, detail) with status derivation from open issues.

## Acceptance Criteria

- [ ] Can view list of machines
- [ ] Machine status reflects open issues correctly
- [ ] Can create new machine
- [ ] Can view machine details
- [ ] Machine page shows its issues
- [ ] Works on mobile (responsive design verified)
- [ ] All tests pass
- [ ] Patterns documented in PATTERNS.md

## Tasks

### Machine List Page

- [ ] Create `src/app/machines/page.tsx`
- [ ] Add auth guard (protected route)
- [ ] Implement direct Drizzle query (Server Component)
  - Query all machines with issue counts, order by name
  - Include open issue counts by severity
- [ ] Display machines in table or cards
  - Show machine name
  - Show derived status badge (see below)
  - Show issue counts
- [ ] Add "Create Machine" button
- [ ] Style with shadcn components

### Machine Status Derivation Logic

- [ ] Create `src/lib/machines/status.ts`
  - `deriveMachineStatus(issues)` helper function
  - Logic:
    - `unplayable`: At least one unplayable issue
    - `needs_service`: At least one playable/minor issue, no unplayable
    - `operational`: No open issues
- [ ] Apply status derivation in machine list query
- [ ] Display status badge with appropriate colors
  - Unplayable: Red/error
  - Needs Service: Yellow/warning
  - Operational: Green/success

### Create Machine Form

- [ ] Create `src/app/machines/actions.ts`
- [ ] Create Server Action for machine creation
  - Zod validation schema (name required, min 1 char) (CORE-SEC-002)
  - Auth check (CORE-SEC-001)
  - Database insert with Drizzle
  - Revalidate path
  - Redirect to machine detail
- [ ] Create `src/app/machines/new/page.tsx`
- [ ] Create form component
  - Name input field
  - Progressive enhancement (works without JS)
  - Server Action submission
  - Display validation errors
- [ ] Update `docs/PATTERNS.md` with Server Action pattern

### Machine Detail Page

- [ ] Create `src/app/machines/[machineId]/page.tsx`
- [ ] Add auth guard
- [ ] Query machine by ID (direct Drizzle)
- [ ] Query machine's open issues
- [ ] Display machine details
  - Machine name
  - Derived status badge
  - Created/updated timestamps
- [ ] Show list of associated issues
  - Link to each issue detail page
  - Show severity, status, title

### Tests

- [ ] Unit tests for validation schemas
- [ ] Unit tests for status derivation logic
- [ ] Integration tests for machine queries
- [ ] Integration tests for machine mutations
- [ ] Integration test: Machine with unplayable issue shows "unplayable" status
- [ ] Integration test: Machine with no issues shows "operational" status
- [ ] E2E test for create machine flow

## Key Decisions

_To be filled during task execution_

## Problems Encountered

_To be filled during task execution_

## Lessons Learned

_To be filled during task execution_

## Updates for CLAUDE.md

_To be filled after completion - what future agents need to know_

## Notes

**Deferred to MVP+:** Machine edit/delete functionality
