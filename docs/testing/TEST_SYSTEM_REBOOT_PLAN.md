# PinPoint Test System Reboot Plan

## Executive Summary

Complete elimination of existing test infrastructure and rebuild from scratch with strict archetype-based system. Every test file declares its archetype in the filename, uses minimal seed data, and is created via slash command to ensure consistency.

## Core Principles

1. **Archetype-First Design**: Every test belongs to exactly one archetype
2. **Multiple Archetypes Per Source**: A source file MAY have multiple test archetypes, but only if necessary and non-redundant (e.g., `user.unit.test.ts` + `user.api.test.ts` if both pure logic AND full API integration are needed)
3. **Filename Declaration**: Test archetype visible in filename (e.g., `user.unit.test.ts`, `issue.integration.test.ts`)
4. **Co-Located Tests**: Unit and integration tests live alongside source files
5. **Minimal Seed Priority**: Use SEED_TEST_IDS first, extended seed only when absolutely necessary
6. **Slash Command Creation**: All tests created via `/create-test` command with templates
7. **Zero Legacy Patterns**: Complete deprecation of all existing test utilities

## Test Archetype System (Renumbered)

### Tier 1: Pure Functions (No Dependencies)

**1. Unit Tests** (`*.unit.test.ts`)

- Pure functions with no external dependencies
- No database, no mocks, no async
- Example: `calculateTotal()`, `formatDate()`, `validateEmail()`

### Tier 2: Component & Service Logic

**2. Component Tests** (`*.component.test.ts`)

- React component testing with React Testing Library
- Mock props and events, no real API calls
- Example: `<IssueCard />`, `<MachineList />`

**3. Service Tests** (`*.service.test.ts`)

- Business logic with mocked dependencies
- Mock database calls, external APIs
- Example: `IssueService.calculatePriority()` with mocked DB

### Tier 3: Database Integration

**4. Repository Tests** (`*.repository.test.ts`)

- Direct database operations via Drizzle
- Uses PGLite with worker-scoped pattern
- Tests queries, mutations, transactions
- Example: `IssueRepository.findByMachine()`

**5. Router Tests** (`*.router.test.ts`)

- tRPC router testing with mock contexts
- Tests input validation, auth checks, response shapes
- No real database, uses mock services
- Example: `issueRouter.create` with mock auth

### Tier 4: Full Integration

**6. API Integration Tests** (`*.api.test.ts`)

- Full tRPC stack with real PGLite database
- Tests complete request/response cycle
- Includes auth, validation, database operations
- Example: Complete issue creation flow

**7. E2E Tests** (`*.e2e.test.ts`)

- Playwright browser automation
- Full application flow testing
- Real browser, real server
- Example: User creates issue through UI

### Tier 5: Database Security & Constraints

**8. RLS Tests** (`*.rls.test.sql`)

- pgTAP tests for Row-Level Security policies
- Native PostgreSQL with session contexts
- Tests security boundaries
- Example: Cross-org access denial

**9. Schema Tests** (`*.schema.test.sql`)

- pgTAP tests for database constraints
- Foreign keys, unique constraints, triggers
- Example: Cascade deletions, unique violations

## File Organization

```
src/
├── server/
│   ├── api/
│   │   └── routers/
│   │       ├── issue.ts
│   │       ├── issue.unit.test.ts        # Archetype 1
│   │       ├── issue.router.test.ts      # Archetype 5
│   │       └── issue.api.test.ts         # Archetype 6
│   ├── services/
│   │   ├── IssueService.ts
│   │   ├── IssueService.unit.test.ts     # Archetype 1
│   │   └── IssueService.service.test.ts  # Archetype 3
│   └── repositories/
│       ├── IssueRepository.ts
│       └── IssueRepository.repository.test.ts  # Archetype 4
├── components/
│   ├── IssueCard.tsx
│   └── IssueCard.component.test.tsx      # Archetype 2
└── e2e/
    └── issue-flow.e2e.test.ts            # Archetype 7

supabase/tests/
├── rls/
│   └── issues.rls.test.sql               # Archetype 8
└── schema/
    └── issues.schema.test.sql            # Archetype 9
```

## Test Creation Decision Flowchart

```
START: What are you testing?
│
├─> Pure computation/logic?
│   └─> Archetype 1: Unit Test
│
├─> React component?
│   └─> Archetype 2: Component Test
│
├─> Business logic with dependencies?
│   └─> Archetype 3: Service Test
│
├─> Database queries/mutations?
│   ├─> Direct Drizzle operations?
│   │   └─> Archetype 4: Repository Test
│   └─> Through tRPC router?
│       ├─> Just router logic?
│       │   └─> Archetype 5: Router Test
│       └─> Full API flow?
│           └─> Archetype 6: API Integration Test
│
├─> User workflow in browser?
│   └─> Archetype 7: E2E Test
│
└─> Database security/constraints?
    ├─> Row-Level Security?
    │   └─> Archetype 8: RLS Test
    └─> Schema constraints?
        └─> Archetype 9: Schema Test
```

## Seed Data Strategy

### Minimal Seed (SEED_TEST_IDS)

- Primary organization: "test-org-pinpoint"
- Competitor organization: "test-org-competitor"
- 3 users per org (admin, member1, member2)
- 2 machines per org
- 2 issues per machine
- Complete role/permission structure

### Extended Seed (seed-extended.ts)

- Additional test data for edge cases
- Must document WHY it can't use minimal seed
- Example: Model with specific serial format
- Loaded only by tests that explicitly require it

## Test Non-Negotiables

1. **NO generateTestId()** - Use SEED_TEST_IDS or extended seed
2. **NO per-test PGlite instances** - Use worker-scoped pattern
3. **NO mixing RLS and business logic tests** - Separate tracks
4. **NO arbitrary mock data** - Use consistent seed patterns
5. **ALWAYS declare archetype** - In filename and test description
6. **ALWAYS use minimal seed first** - Extended only when justified
7. **NEVER mix archetype patterns** - One archetype per file

## New Test Utilities

### Core Utilities (From Scratch)

```typescript
// test-helpers/core/
├── worker-db.ts          # Worker-scoped PGlite management
├── mock-factory.ts       # Consistent mock generation
├── test-context.ts       # tRPC context creation
├── assertions.ts         # Custom test assertions
└── seed-loader.ts        # Seed data management
```

### Archetype Templates

```typescript
// test-helpers/templates/
├── unit.template.ts
├── component.template.tsx
├── service.template.ts
├── repository.template.ts
├── router.template.ts
├── api.template.ts
├── e2e.template.ts
├── rls.template.sql
└── schema.template.sql
```

## Slash Command: `/create-test`

### Command Flow

1. Prompt: "What file are you testing?"
2. Analyze file to suggest archetype
3. Show decision tree, confirm archetype
4. Copy appropriate template
5. Customize with file-specific imports
6. Run template test to verify it works
7. Run formatters, linters, type-check
8. Save test file with correct naming

### Template Validation

- Each template includes simple working test
- Slash command runs test before saving
- Ensures no broken tests are created

## Migration Phases

### Phase 1: Infrastructure Setup

- [ ] Create new test utilities from scratch
- [ ] Design archetype templates with examples
- [ ] Build `/create-test` slash command
- [ ] Create seed-extended.ts structure
- [ ] Document test non-negotiables

### Phase 2: Test Elimination

- [ ] Archive existing tests (don't delete permanently yet)
- [ ] Move to `.deprecated-tests/` directory
- [ ] Remove all test utilities to `/deprecated/`
- [ ] Clean up package.json test scripts

### Phase 3: Systematic Recreation

- [ ] Analyze each source file
- [ ] Determine required archetypes
- [ ] Use slash command to create tests
- [ ] Validate each test passes
- [ ] Track coverage metrics

### Phase 4: Validation

- [ ] All archetypes represented
- [ ] No legacy patterns remain
- [ ] 100% compliance with non-negotiables
- [ ] Performance benchmarks met

## Success Metrics

1. **Zero test flakiness** - Predictable seed data
2. **Clear archetype boundaries** - No hybrid patterns
3. **Fast execution** - Proper archetype selection
4. **100% slash command creation** - No manual test files
5. **Minimal extended seed** - Most tests use core SEED_TEST_IDS

## Implementation Priority

1. **Critical Path** (Week 1)
   - Archetype templates
   - Slash command
   - Worker-scoped DB utility

2. **Core Coverage** (Week 2)
   - Router tests (Archetype 5)
   - Repository tests (Archetype 4)
   - Unit tests (Archetype 1)

3. **Full Coverage** (Week 3)
   - API Integration (Archetype 6)
   - RLS tests (Archetype 8)
   - E2E tests (Archetype 7)

## Open Questions

1. Should we version archetype templates for future evolution?
2. How to handle tests that genuinely need multiple archetypes?
3. Should extended seed be per-module or global?
4. Naming convention for cross-cutting concerns (e.g., permissions)?

## Next Steps

1. Review and refine archetype definitions
2. Create first template (unit test)
3. Build minimal `/create-test` command
4. Test on single module (e.g., issues)
5. Iterate based on learnings

---

**Status**: DRAFT - Ready for iteration
**Author**: Test System Reboot Initiative
**Date**: 2025-08-23
