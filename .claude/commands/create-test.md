---
allowed-tools: Read, Write, MultiEdit, Glob, Bash(npm test:*), Bash(npm run test:*), Bash(npx vitest:*), Bash(npm run lint:*), Bash(npx prettier:*)
argument-hint: <file-path>
description: Create comprehensive tests using 9-archetype system with decision tree analysis
---

# Test Creation Command - 9 Archetype System

Create tests following the COMPREHENSIVE_RSC_TEST_SYSTEM_PLAN.md with RSC-adapted archetype decision tree analysis.

## Target File: $ARGUMENTS

You will analyze the target file and suggest the appropriate test archetype(s) using the decision flowchart.

## Decision Flowchart Analysis

Analyze `$ARGUMENTS` and determine the appropriate archetype:

**START: What are you testing? (RSC-Adapted Decision Tree)**

```
├─> Pure computation/logic (utilities, validation)?
│   └─> Archetype 1: Unit Test (*.unit.test.ts)
│
├─> Server Component (async, direct DB access)?
│   └─> Archetype 2: Server Component Test (*.server-component.test.ts)
│
├─> Client Island (minimal interactivity)?
│   └─> Archetype 3: Client Island Test (*.client-island.test.tsx)
│
├─> Server Action (FormData processing)?
│   └─> Archetype 4: Server Action Test (*.server-action.test.ts)
│
├─> Hybrid Component (server shell + client islands)?
│   └─> Archetype 5: Hybrid Component Test (*.hybrid-component.test.tsx)
│
├─> DAL functions (direct database queries for Server Components)?
│   └─> Archetype 6: DAL Integration Test (*.dal.test.ts)
│
├─> User workflow in browser (RSC + client islands)?
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
   - Use appropriate RSC-adapted template for selected archetype:
     - **Archetype 1**: `unit.template.ts` - Pure functions (Server Action utilities, validation) ✅ READY
     - **Archetype 2**: `server-component.template.ts` - Server Components with database integration
     - **Archetype 3**: `client-island.template.tsx` - Minimal interactive components with RTL
     - **Archetype 4**: `server-action.template.ts` - FormData processing, validation, mutations ✅ READY
     - **Archetype 5**: `hybrid-component.template.tsx` - Server/client boundary testing
     - **Archetype 6**: `dal.template.ts` - Direct database functions for Server Components ✅ READY
     - **Archetype 7**: `e2e.template.ts` - Playwright RSC workflow tests
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

- Template: `src/test/templates/unit.template.ts` ✅ READY
- Helpers: `src/test/generated/mocks.ts` (for consistent mock data)
- Focus: Server Action utilities, validation functions, formatters

**Archetype 2 (Server Component Test)**:

- Template: `src/test/templates/server-component.template.ts`
- Helpers: `src/test/rsc-helpers/server-component-renderer.ts`
- Focus: Async Server Components with database integration, organization scoping

**Archetype 3 (Client Island Test)**:

- Template: `src/test/templates/client-island.template.tsx`
- Helpers: Standard React Testing Library patterns
- Focus: Minimal interactive components with server-passed props

**Archetype 4 (Server Action Test)**:

- Template: `src/test/templates/server-action.template.ts` ✅ READY
- Helpers: `src/test/server-action-helpers/form-data.ts`
- Focus: FormData processing, validation, authentication boundaries

**Archetype 5 (Hybrid Component Test)**:

- Template: `src/test/templates/hybrid-component.template.tsx`
- Helpers: `src/test/hybrid-helpers/hybrid-renderer.ts`
- Focus: Server shell + client island integration, boundary data flow

**Archetype 6 (DAL Integration Test)**:

- Template: `src/test/templates/dal.template.ts` ✅ READY
- Helpers: `src/test/worker-db.ts` for worker-scoped PGlite
- Focus: Direct database functions called by Server Components

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

- **Master Plan**: @RSC_MIGRATION/COMPREHENSIVE_RSC_TEST_SYSTEM_PLAN.md
- **RSC Integration**: @RSC_MIGRATION/RSC_TEST_SYSTEM_INTEGRATION.md
- **Non-Negotiables**: @docs/NON_NEGOTIABLES.md
- **Seed Constants**: @src/test/constants/seed-test-ids.ts

## Test Non-Negotiables

Enforce these patterns from @docs/NON_NEGOTIABLES.md:

- **NO generateTestId()** - Use SEED_TEST_IDS or extended seed
- **NO per-test PGlite instances** - Use worker-scoped pattern
- **NO mixing RLS and business logic tests** - Separate tracks
- **NO arbitrary mock data** - Use consistent seed patterns
- **ALWAYS declare archetype** - In filename and test description
- **ALWAYS use minimal seed first** - Extended only when justified
- **NEVER mix archetype patterns** - One archetype per file
- **RSC-SPECIFIC PATTERNS**:
  - **NO direct unit testing of async Server Components** - Use integration or E2E
  - **ALWAYS test organization scoping** - Multi-tenant security critical
  - **ALWAYS verify cache() optimization** - Performance requirement
  - **ALWAYS test FormData validation** - Server Action input safety
  - **ALWAYS test progressive enhancement** - Forms must work without JS

## Expected Output

Generate test file with:

- Correct archetype naming convention
- 100% passing test suite
- Integration with existing infrastructure
- Proper TypeScript types and imports
- Formatted and linted code

Focus on creating fast, reliable tests that follow the established archetype patterns and validate the core functionality of the target file.
