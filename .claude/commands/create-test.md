---
allowed-tools: Read, Write, MultiEdit, Glob, Bash(npm test:*), Bash(npm run test:*), Bash(npx vitest:*), Bash(npm run lint:*), Bash(npx prettier:*)
argument-hint: <file-path>
description: Create comprehensive tests using 9-archetype system with decision tree analysis
---

# Test Creation Command - 9 Archetype System

Create tests following the TEST_SYSTEM_REBOOT_PLAN.md with archetype-based decision tree analysis.

## Target File: $ARGUMENTS

You will analyze the target file and suggest the appropriate test archetype(s) using the decision flowchart.

## Decision Flowchart Analysis

Analyze `$ARGUMENTS` and determine the appropriate archetype:

**START: What are you testing?**

```
├─> Pure computation/logic?
│   └─> Archetype 1: Unit Test (*.unit.test.ts)
│
├─> React component?
│   └─> Archetype 2: Component Test (*.component.test.tsx)
│
├─> Business logic with dependencies?
│   └─> Archetype 3: Service Test (*.service.test.ts)
│
├─> Database queries/mutations?
│   ├─> Direct Drizzle operations?
│   │   └─> Archetype 4: Repository Test (*.repository.test.ts)
│   └─> Through tRPC router?
│       ├─> Just router logic?
│       │   └─> Archetype 5: Router Test (*.router.test.ts)
│       └─> Full API flow?
│           └─> Archetype 6: API Integration Test (*.api.test.ts)
│
├─> User workflow in browser?
│   └─> Archetype 7: E2E Test (*.e2e.test.ts)
│
└─> Database security/constraints?
    ├─> Row-Level Security?
    │   └─> Archetype 8: RLS Test (*.rls.test.sql)
    └─> Schema constraints?
        └─> Archetype 9: Schema Test (*.schema.test.sql)
```

## Implementation Process

1. **Analyze Target File**
   - Read and understand the code structure
   - Identify: functions, components, services, database operations
   - Suggest primary archetype based on decision tree

2. **Confirm Archetype Selection**
   - Present analysis and suggested archetype
   - Show decision tree path taken
   - Allow user to confirm or select different archetype

3. **Load Archetype-Specific Files**
   - Based on confirmed archetype, read only the relevant files from Dynamic File Recommendations
   - Check if template exists for selected archetype
   - If template missing: Show "Archetype X not ready yet - see Issue #YYY"
   - Load required helpers and examples for the specific archetype

4. **Apply Template**
   - Use appropriate template for selected archetype:
     - **Archetype 1**: `unit.template.ts` - Pure functions (no dependencies)
     - **Archetype 2**: `component.template.tsx` - React components with RTL
     - **Archetype 3**: `service.template.ts` - Business logic with mocked dependencies (ready)
     - **Archetype 4**: `repository.template.ts` - Database operations with PGlite
     - **Archetype 5**: `router.template.ts` - tRPC router with mock contexts
     - **Archetype 6**: `api.template.ts` - Full API integration tests
     - **Archetype 7**: `e2e.template.ts` - Playwright E2E tests
     - **Archetype 8**: `rls.template.sql` - pgTAP RLS policy tests
     - **Archetype 9**: `schema.template.sql` - pgTAP schema constraint tests

5. **Customize Template**
   - Replace template placeholders with actual file imports
   - Identify and test actual methods/functions
   - Apply proper TypeScript types
   - Use auto-generated mocks and seed constants

6. **Validation Pipeline**
   - Run generated tests to ensure they pass
   - Run prettier formatting
   - Run ESLint validation
   - Run TypeScript type checking

7. **Save with Correct Naming**
   - Use archetype naming convention: `{filename}.{archetype}.test.{ext}`
   - Place in correct location (co-located with source)

## Dynamic File Recommendations

Based on the selected archetype, I will recommend specific files to read:

**Archetype 1 (Unit Test)**:

- Template: `src/test/templates/unit.template.ts` (Issue #349)
- Helpers: `src/test/generated/mocks.ts` (for consistent mock data)

**Archetype 2 (Component Test)**:

- Template: `src/test/templates/component.template.tsx` (Issue #350)
- Helpers: `src/test/generated/mocks.ts` (for mock props)

**Archetype 3 (Service Test)**:

- Template: `src/test/templates/service.template.ts` (ready)
- Helpers: `src/test/helpers/service-test-helpers.ts`
- Example: `src/server/services/roleService.simple.service.test.ts`

**Archetype 4 (Repository Test)**:

- Template: `src/test/templates/repository.template.ts` (Issue #352)
- Helpers: `src/test/helpers/worker-db.ts` (Issue #345)
- Constants: `src/test/generated/seed-test-ids.ts` (Issue #346)

**Archetype 5 (Router Test)**:

- Template: `src/test/templates/router.template.ts` (Issue #353)
- Helpers: `src/test/helpers/test-context.ts` (Issue #345)
- Mocks: `src/test/generated/mocks.ts` (Issue #346)

**Archetype 6 (API Integration Test)**:

- Template: `src/test/templates/api.template.ts` (Issue #354)
- Helpers: `src/test/helpers/worker-db.ts`, `src/test/helpers/test-context.ts` (Issue #345)
- Constants: `src/test/generated/seed-test-ids.ts` (Issue #346)

**Archetype 7 (E2E Test)**:

- Template: `src/test/templates/e2e.template.ts` (Issue #355)
- Constants: `src/test/generated/seed-test-ids.ts` (for predictable data)

**Archetype 8 (RLS Test)**:

- Template: `src/test/templates/rls.template.sql` (Issue #356)
- Examples: Files in `supabase/tests/rls/`

**Archetype 9 (Schema Test)**:

- Template: `src/test/templates/schema.template.sql` (Issue #357)
- Examples: Files in `supabase/tests/`

**Always Available**:

- **Master Plan**: @docs/testing/TEST_SYSTEM_REBOOT_PLAN.md
- **Non-Negotiables**: @docs/NON_NEGOTIABLES.md

## Test Non-Negotiables

Enforce these patterns from @docs/NON_NEGOTIABLES.md:

- **NO generateTestId()** - Use SEED_TEST_IDS or extended seed
- **NO per-test PGlite instances** - Use worker-scoped pattern
- **NO mixing RLS and business logic tests** - Separate tracks
- **NO arbitrary mock data** - Use consistent seed patterns
- **ALWAYS declare archetype** - In filename and test description
- **ALWAYS use minimal seed first** - Extended only when justified
- **NEVER mix archetype patterns** - One archetype per file

## Expected Output

Generate test file with:

- Correct archetype naming convention
- 100% passing test suite
- Integration with existing infrastructure
- Proper TypeScript types and imports
- Formatted and linted code

Focus on creating fast, reliable tests that follow the established archetype patterns and validate the core functionality of the target file.
