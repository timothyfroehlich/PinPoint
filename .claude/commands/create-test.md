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

3. **Apply Template**
   - Use appropriate template for selected archetype:
     - **Archetype 1**: Pure functions (no dependencies)
     - **Archetype 2**: React components with RTL
     - **Archetype 3**: Business logic with mocked dependencies (@src/test/templates/service.test.template.ts)
     - **Archetype 4**: Database operations with PGlite
     - **Archetype 5**: tRPC router with mock contexts
     - **Archetype 6**: Full API integration tests
     - **Archetype 7**: Playwright E2E tests
     - **Archetype 8**: pgTAP RLS policy tests
     - **Archetype 9**: pgTAP schema constraint tests

4. **Customize Template**
   - Replace template placeholders with actual file imports
   - Identify and test actual methods/functions
   - Apply proper TypeScript types
   - Use SEED_TEST_IDS and service-test-helpers

5. **Validation Pipeline**
   - Run generated tests to ensure they pass
   - Run prettier formatting
   - Run ESLint validation
   - Run TypeScript type checking

6. **Save with Correct Naming**
   - Use archetype naming convention: `{filename}.{archetype}.test.{ext}`
   - Place in correct location (co-located with source)

## Available Infrastructure

Reference these established patterns:

- **Templates**: @src/test/templates/service.test.template.ts (more coming)
- **Test Helpers**: @src/test/helpers/service-test-helpers.ts
- **Test Constants**: @src/test/constants/seed-test-ids.ts
- **Working Example**: @src/server/services/roleService.simple.service.test.ts
- **Archetype Guide**: @docs/testing/SERVICE_TESTS_ARCHETYPE.md
- **Master Plan**: @docs/testing/TEST_SYSTEM_REBOOT_PLAN.md

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
