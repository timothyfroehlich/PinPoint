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

This must be well thought out and clear.

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
- Create a threshold for maximum allowed entries in the extended seed. let's start it at 20. Add to the NON_NEGOTIABLES that we can't exceed this number. If we do then we need to integrate some into the core seeds.
- Seed files:
  - minimal
  - minimal_plus_test_data
  - full (includes minimal but not minimal_plus_test_data)

### External API Fixture Strategy

**Preserve Existing Pinballmap Fixtures**: Current fixture system for OPDB/pinballmap API responses will be maintained during reboot.

**Fixture Scope**:

- External API responses (pinballmap, OPDB catalog)
- File upload mocks
- Third-party service responses

**Implementation**:

- Keep existing fixture files and loading utilities
- Fixtures remain separate from seed data system
- Tests requiring external data use fixture system, not extended seed

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

## Coverage Management Strategy

### Coverage Philosophy

**Accept Zero Coverage Reset**: Current test suite is broken with hybrid anti-patterns. Better to rebuild coverage systematically with quality tests than preserve broken baseline.

**Archetype-Driven Coverage**: Track coverage by test archetype to ensure balanced testing approach, not just overall percentage.

### Coverage Configuration Setup

#### 1. Vitest Configuration Updates

```typescript
// vitest.config.ts - Reboot-friendly settings
coverage: {
  enabled: enableCoverage,
  provider: "v8",
  reporter: ["text", "json", "html", "lcov"],
  reportsDirectory: "./coverage",
  exclude: [
    "node_modules/",
    "src/test/",
    ".deprecated-tests/",      // Archived legacy tests
    "**/*.test.{ts,tsx}",
    "**/*.vitest.test.{ts,tsx}",
    "**/*.spec.{ts,tsx}",
    "src/_archived_frontend/",
    "e2e/",
    "playwright-report/",
    "test-results/",
    "*.config.{ts,js}",
    "scripts/",
    ".next/",
    "docs/",
  ],
  include: ["src/**/*.{ts,tsx}"],
  thresholds: {
    global: {
      branches: 5,           // Ultra-low for reboot period
      functions: 5,
      lines: 5,
      statements: 5,
    },
    // Remove module-specific thresholds during reboot
  },
},
```

#### 2. Codecov Configuration Consolidation

```yaml
# .codecov.yml (remove codecov.yml)
coverage:
  status:
    project:
      default:
        target: 5% # Start ultra-low
        threshold: 2%
        informational: true # Don't block PRs initially
    patch:
      default:
        target: 70% # New code should be well-tested
        threshold: 10%
        informational: true

# Archetype-based flags for granular tracking
flags:
  unit-tests:
    paths: ["src/**/*.unit.test.ts"]
  component-tests:
    paths: ["src/**/*.component.test.tsx"]
  service-tests:
    paths: ["src/**/*.service.test.ts"]
  repository-tests:
    paths: ["src/**/*.repository.test.ts"]
  router-tests:
    paths: ["src/**/*.router.test.ts"]
  api-tests:
    paths: ["src/**/*.api.test.ts"]
  e2e-tests:
    paths: ["src/**/*.e2e.test.ts"]

ignore:
  - ".deprecated-tests/**"
  - "src/test/__archived__/**"
  - "src/_archived_frontend/**"

comment:
  behavior: default
  layout: "diff, flags, files"
  require_changes: false
```

#### 3. GitHub Actions Enhancement

```yaml
# .github/workflows/ci.yml modifications needed
- name: Upload coverage with archetype flags
  run: |
    # Upload with specific flags based on test type
    if [[ "${{ matrix.shard }}" == "unit-node" ]]; then
      npx codecov --flag unit-tests,service-tests
    elif [[ "${{ matrix.shard }}" == "unit-jsdom" ]]; then
      npx codecov --flag component-tests
    elif [[ "${{ matrix.shard }}" == "integration" ]]; then
      npx codecov --flag repository-tests,router-tests,api-tests
    fi
```

### Weekly Coverage Ramp-Up Strategy

#### Week 1: Infrastructure & Unit Tests (Target: 5-10%)

**Focus**: Pure function unit tests (Archetype 1)
**Coverage Actions**:

- [ ] Implement core utility functions testing
- [ ] Validation functions, formatters, calculators
- [ ] Set ultra-low thresholds (5%) in all configs
- [ ] **Coverage Gate**: Informational only, no PR blocking

**Expected Breakdown**:

```
Project Coverage: 8%
├── unit-tests: 8% ✅
├── component-tests: 0%
├── repository-tests: 0%
├── router-tests: 0%
├── api-tests: 0%
└── e2e-tests: 0%
```

#### Week 2: Services & Components (Target: 15-25%)

**Focus**: Service tests (Archetype 3) + Component tests (Archetype 2)
**Coverage Actions**:

- [ ] Business logic services with mocked dependencies
- [ ] React component tests with RTL
- [ ] Increase thresholds to 15% global
- [ ] **Coverage Gate**: Still informational, start monitoring trends

**Expected Breakdown**:

```
Project Coverage: 22%
├── unit-tests: 12% ✅
├── component-tests: 5% ✅
├── service-tests: 5% ✅
├── repository-tests: 0%
├── router-tests: 0%
├── api-tests: 0%
└── e2e-tests: 0%
```

#### Week 3: Database & Router Integration (Target: 30-45%)

**Focus**: Repository tests (Archetype 4) + Router tests (Archetype 5)
**Coverage Actions**:

- [ ] Drizzle query/mutation testing with PGlite
- [ ] tRPC router tests with mock contexts
- [ ] Increase thresholds to 30% global
- [ ] **Coverage Gate**: Enable soft blocking (informational false)

**Expected Breakdown**:

```
Project Coverage: 38%
├── unit-tests: 15% ✅
├── component-tests: 8% ✅
├── service-tests: 7% ✅
├── repository-tests: 5% ✅
├── router-tests: 3% ✅
├── api-tests: 0%
└── e2e-tests: 0%
```

#### Week 4: Full Integration (Target: 45-65%)

**Focus**: API Integration tests (Archetype 6)
**Coverage Actions**:

- [ ] Full tRPC stack testing with real PGlite
- [ ] End-to-end API workflows
- [ ] Increase thresholds to 45% global
- [ ] **Coverage Gate**: Full blocking enabled

**Expected Breakdown**:

```
Project Coverage: 58%
├── unit-tests: 18% ✅
├── component-tests: 10% ✅
├── service-tests: 12% ✅
├── repository-tests: 8% ✅
├── router-tests: 5% ✅
├── api-tests: 5% ✅
└── e2e-tests: 0%
```

#### Week 5+: Optimization & E2E (Target: 60%+)

**Focus**: E2E tests (Archetype 7) + Coverage optimization
**Coverage Actions**:

- [ ] Critical user flow E2E tests
- [ ] Identify and fill coverage gaps
- [ ] Set final production thresholds (60%+ global)
- [ ] **Coverage Gate**: Production-ready blocking

### Coverage Quality Metrics

#### Archetype Balance Requirements

- **Unit Tests**: Should provide 40-60% of total coverage
- **Integration Tests**: Should provide 30-40% of total coverage
- **E2E Tests**: Should provide 5-15% of total coverage
- **No Single Archetype Dominance**: No archetype > 70% of total coverage

#### Coverage Quality Gates

```yaml
# Advanced .codecov.yml for Week 4+
coverage:
  status:
    project:
      target: 60%
      threshold: 3%
    patch:
      target: 80%
      threshold: 5%

  # Prevent coverage regression
  round: down
  precision: 2
```

### Implementation Tasks

#### Immediate Configuration Changes

- [ ] Update vitest.config.ts with reboot thresholds
- [ ] Consolidate to single .codecov.yml with archetype flags
- [ ] Modify GitHub Actions for flag-based uploads
- [ ] Add package.json coverage scripts for monitoring

#### Weekly Monitoring Tasks

- [ ] Track coverage by archetype weekly
- [ ] Identify coverage gaps and prioritize
- [ ] Adjust thresholds based on actual progress
- [ ] Document coverage quality patterns in test guidelines

#### Coverage Progress Dashboard

Create `docs/testing/coverage-progress.md` with:

- [ ] Weekly coverage targets and actual results
- [ ] Archetype breakdown analysis
- [ ] Coverage quality metrics tracking
- [ ] Areas needing focused testing attention

## Success Metrics

1. **Zero test flakiness** - Predictable seed data
2. **Clear archetype boundaries** - No hybrid patterns
3. **Fast execution** - Proper archetype selection
4. **100% slash command creation** - No manual test files
5. **Minimal extended seed** - Most tests use core SEED_TEST_IDS

## Implementation Priority

### Week 1: Infrastructure & Coverage Reset (5-10% target)

**Infrastructure Setup**:

- [ ] Update vitest.config.ts with reboot-friendly thresholds (5%)
- [ ] Consolidate codecov configuration with archetype flags
- [ ] Update GitHub Actions for flag-based coverage uploads
- [ ] Create archetype templates (Unit, Component, Service)
- [ ] Build `/create-test` slash command with archetype analysis
- [ ] Set up worker-scoped DB utility

**First Tests (Archetype 1 - Unit Tests)**:

- [ ] Core utility function tests
- [ ] Validation logic tests
- [ ] Formatter/calculator tests
- [ ] Focus on pure functions only

### Week 2: Services & Components (15-25% target)

**Template Expansion**:

- [ ] Service test templates (Archetype 3) with mocked dependencies
- [ ] Component test templates (Archetype 2) with RTL
- [ ] Mock factory utilities

**Test Implementation**:

- [ ] Business logic service tests
- [ ] React component tests
- [ ] Increase coverage thresholds to 15%
- [ ] Coverage monitoring dashboard setup

### Week 3: Database Integration (30-45% target)

**Database Testing Infrastructure**:

- [ ] Repository test templates (Archetype 4) with PGlite
- [ ] Router test templates (Archetype 5) with mock contexts
- [ ] Enhanced seed data utilities

**Integration Tests**:

- [ ] Drizzle query/mutation tests
- [ ] tRPC router tests
- [ ] Increase coverage thresholds to 30%
- [ ] Enable soft coverage gates

### Week 4: Full API Integration (45-65% target)

**Full Stack Testing**:

- [ ] API Integration test templates (Archetype 6)
- [ ] End-to-end API workflow tests
- [ ] Enhanced mock contexts for complex scenarios

**Coverage Hardening**:

- [ ] Increase coverage thresholds to 45%
- [ ] Enable full coverage blocking
- [ ] Coverage quality analysis

### Week 5+: E2E & Optimization (60%+ target)

**Final Archetype Implementation**:

- [ ] E2E test templates (Archetype 7) with Playwright
- [ ] RLS test templates (Archetype 8) with pgTAP
- [ ] Schema test templates (Archetype 9) with pgTAP

**System Finalization**:

- [ ] Production coverage thresholds (60%+)
- [ ] Coverage quality gates enforcement
- [ ] Legacy test cleanup
- [ ] Documentation finalization

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
