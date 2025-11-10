# General Code Review Procedure (2025)

**Objective**: Comprehensive review checklist for all code types using PinPoint's established patterns and August 2025 tech stack best practices.

**Context**:

- **Tech Stack**: Next.js 15, React 19, Drizzle ORM, Supabase SSR, Vitest v4.0, PGlite testing
- **Focus**: Pattern enforcement, memory safety, schema compliance, and quality assurance
- **Standards**: Modern full-stack development with comprehensive testing and security

**Scope**: All code files within Pull Requests, with emphasis on PinPoint-specific architectural constraints.

---

## Pre-Review Analysis

### File Categorization

For each modified file, categorize as:

- `TRPC_ROUTER`: tRPC router file (`src/server/api/routers/*.ts`)
- `SERVER_ACTION`: Next.js Server Actions file (`src/app/actions/*.ts`)
- `SERVER_COMPONENT`: Next.js Server Component (`src/app/**/*.tsx`)
- `REACT_COMPONENT`: React client component (`src/components/**/*.tsx`)
- `DATABASE_SCHEMA`: Database schema file (`src/server/db/schema/*.ts`)
- `UNIT_TEST`: Unit test with mocked dependencies (`src/**/*.test.ts`)
- `INTEGRATION_TEST`: Integration test with PGlite database (`src/**/*.integration.test.ts`)
- `SERVICE_LAYER`: Business logic service (`src/server/services/*.ts`)
- `UTILITY`: Pure function utilities (`src/lib/utils/*.ts`)
- `HOOK`: React hooks (`src/hooks/*.ts`)
- `CONFIGURATION`: Config files (`*.config.js`, `tsconfig.json`, `package.json`)
- `DOCUMENTATION`: Documentation file (`docs/**/*.md`)
- `OTHER`: Any other file type

---

## 🚨 CRITICAL: Mandatory Safety Validations

### ⛔ ABSOLUTELY FORBIDDEN Patterns

**These patterns MUST be flagged as 🔴 CRITICAL and blocked:**

#### Memory Safety Violations

- [ ] **🔴 BLOCKING**: Uses dangerous PGlite patterns
  - [ ] ❌ FORBIDDEN: `createSeededTestDatabase()` in `beforeEach()` or per-test
  - [ ] ❌ FORBIDDEN: `new PGlite()` in individual tests
  - [ ] ❌ FORBIDDEN: Multiple database instances per test file
  - [ ] ✅ REQUIRED: `import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db"`

#### Migration File Creation

- [ ] **🔴 BLOCKING**: No migration files in pre-beta
  - [ ] ❌ FORBIDDEN: Files in `supabase/migrations/`
  - [ ] ❌ FORBIDDEN: Commands like `drizzle-kit generate`, `npm run db:generate`

#### Vitest Command Issues

- [ ] **🔴 BLOCKING**: No redirection with Vitest commands
  - [ ] ❌ FORBIDDEN: `npm test 2>&1`, `npm test >`, `npm test >>`
  - [ ] ❌ FORBIDDEN: `vitest 2>&1` or similar redirection patterns

#### Schema Modification

- [ ] **🔴 BLOCKING**: Schema is LOCKED - no changes to fix TypeScript errors
  - [ ] ❌ FORBIDDEN: Schema changes to accommodate code
  - [ ] ✅ REQUIRED: Code conforms to existing schema structure

#### Deprecated Patterns

- [ ] **🔴 BLOCKING**: No deprecated Supabase patterns
  - [ ] ❌ FORBIDDEN: `@supabase/auth-helpers` imports
  - [ ] ⚠️ NOTE: For agents, prefer `./scripts/safe-psql.sh`; human contributors may use `psql` directly

---

## Automated Review Checklist

### Category: `TRPC_ROUTER` - tRPC Router Files

#### 🔐 Security & Multi-Tenancy

- [ ] **Organization Scoping**: Every query includes `eq(table.organizationId, ctx.organizationId)`
- [ ] **Permission Validation**: Proper `protectedProcedure` or `orgScopedProcedure` usage
- [ ] **Input Validation**: Zod schemas properly validate all inputs
- [ ] **Error Handling**: Uses `TRPCError` with appropriate error codes

#### 🗄️ Modern Drizzle Patterns

- [ ] **Relational Queries**: Uses `db.query.table.findMany({ with: { ... } })` for relationships
- [ ] **Core Operations**: Proper `db.insert().values().returning()` patterns
- [ ] **Type Safety**: Uses `$inferSelect`/`$inferInsert` for type safety

#### 📊 SEED_TEST_IDS Usage

- [ ] **Test Constants**: References `SEED_TEST_IDS` for predictable test data
- [ ] **Mock Context**: Uses `createMockAdminContext()` patterns where applicable

---

### Category: `SERVER_ACTION` - Next.js Server Actions

#### 🔒 Authentication & Authorization

- [ ] **Supabase SSR**: Uses `@supabase/ssr` for server-side auth (not deprecated auth-helpers)
- [ ] **Auth Validation**: Proper user authentication and session handling
- [ ] **Organization Scoping**: Multi-tenant data access properly scoped

#### 📥 Input Validation & Processing

- [ ] **FormData Handling**: Proper extraction and validation of form data
- [ ] **Zod Validation**: Input schemas validate all form fields
- [ ] **Error Handling**: Graceful error handling with user-friendly messages

#### ⚡ Performance & UX

- [ ] **Cache Invalidation**: Uses `revalidatePath()` or `revalidateTag()` appropriately
- [ ] **Redirect Handling**: Proper redirects on success/error states

---

### Category: `INTEGRATION_TEST` - PGlite Database Testing

#### 🚨 CRITICAL: Memory Pattern Validation (MANDATORY)

- [ ] **🔴 BLOCKING**: Uses worker-scoped database pattern (NOT per-test instances)
  - [ ] ❌ FORBIDDEN: `createSeededTestDatabase()` in `beforeEach()` or per-test
  - [ ] ❌ FORBIDDEN: `new PGlite()` in individual tests
  - [ ] ❌ FORBIDDEN: Multiple database instances per test file
  - [ ] ✅ REQUIRED: `import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db"`
  - [ ] ✅ REQUIRED: `test("...", async ({ workerDb }) => await withIsolatedTest(workerDb, ...))`

#### 📊 SEED_TEST_IDS Architecture

- [ ] **Hardcoded IDs**: Uses `SEED_TEST_IDS` constants for predictable data
- [ ] **Cross-org Testing**: Uses both `ORGANIZATIONS.primary` and `ORGANIZATIONS.competitor`
- [ ] **Mock Patterns**: Uses `SEED_TEST_IDS.MOCK_PATTERNS` for unit test mocks

#### 🔍 High-Fidelity Validation

- [ ] **Real Queries**: Tests execute actual Drizzle queries against PostgreSQL
- [ ] **Database Constraints**: Validates UNIQUE constraints, foreign keys, cascades
- [ ] **RLS Context**: Proper organizational context establishment

---

### Category: `UNIT_TEST` - Modern Vitest Unit Tests

#### 🧪 Type-Safe Mocking Strategy

- [ ] **Modern Mocking**: Uses `vi.mock` with `vi.importActual<typeof ModuleType>()`
- [ ] **Hoisted State**: Uses `vi.hoisted(() => ({ mockFn: vi.fn() }))` for shared state
- [ ] **Module-level Mocking**: Mocks at module level instead of individual methods

#### 📊 SEED_TEST_IDS Usage

- [ ] **Mock Patterns**: Uses `SEED_TEST_IDS.MOCK_PATTERNS` for consistent mock IDs
- [ ] **Predictable Data**: Avoids random ID generation in favor of constants

#### 📊 Test Quality Standards

- [ ] **AAA Pattern**: Clear Arrange, Act, Assert structure
- [ ] **Performance**: Unit tests complete under 100ms each
- [ ] **Type Safety**: All mocks properly typed with schema inference

---

### Category: `SERVER_COMPONENT` - Next.js Server Components

#### 🔄 Data Fetching Patterns

- [ ] **Direct Database Access**: Uses Drizzle database client directly
- [ ] **Async Structure**: Component properly handles async database operations
- [ ] **Error Handling**: Implements proper error boundaries and not-found pages

#### 🔐 Authentication & Security

- [ ] **Server Auth**: Uses `@supabase/ssr` for server-side authentication
- [ ] **Organization Scoping**: All queries properly scoped to user's organization
- [ ] **Permission Checks**: Renders content based on user permissions

---

### Category: `REACT_COMPONENT` - Client Components

#### ⚡ Modern React Patterns

- [ ] **React 19**: Uses modern patterns (Server Actions, optimistic updates)
- [ ] **TypeScript**: Proper TypeScript with strict type checking
- [ ] **Performance**: Uses React.memo, useCallback, useMemo appropriately

#### 🎨 UI/UX Standards

- [ ] **Accessibility**: Proper ARIA attributes and semantic HTML
- [ ] **Responsive**: Mobile-first responsive design
- [ ] **Loading States**: Proper loading and error state handling

---

### Category: `DATABASE_SCHEMA` - Schema Files

#### 🗄️ Modern Drizzle Schema Patterns

- [ ] **Generated Columns**: Uses `.generatedAlwaysAs()` for computed fields
- [ ] **Enhanced Indexes**: Uses `.on(table.column.asc())` syntax
- [ ] **Type Inference**: Proper `$inferSelect`/`$inferInsert` patterns
- [ ] **Relationships**: Proper foreign key constraints and relations

#### 🔐 Security & Multi-tenancy

- [ ] **Organization Scoping**: Includes `organizationId` columns where needed
- [ ] **Data Integrity**: Proper constraints and validation at database level

---

### Category: `DOCUMENTATION` - Documentation Updates

#### 📝 Content Accuracy & Completeness

- [ ] **Current Standards**: Reflects modern development practices (August 2025)
- [ ] **SEED_TEST_IDS**: All examples use hardcoded IDs, not random generation
- [ ] **Pattern Examples**: Uses current architectural patterns

#### 🎯 PinPoint-Specific Patterns

- [ ] **Testing Patterns**: Worker-scoped PGlite, dual-track testing approach
- [ ] **Security Patterns**: Organization scoping, RLS implementation
- [ ] **Memory Safety**: Worker-scoped database patterns documented

---

## Quality Gates & Validation

### 🔍 Mandatory Validation Steps

For each modified file, ensure:

- [ ] **TypeScript Compilation**: `npm run typecheck` passes without errors
- [ ] **ESLint Compliance**: `npm run lint` passes without violations
- [ ] **Test Execution**: All relevant tests pass using modern patterns
- [ ] **Build Success**: `npm run build` completes successfully
- [ ] **Memory Safety**: No dangerous PGlite patterns detected
- [ ] **Schema Compliance**: Code conforms to locked schema structure

### ⏱️ Performance Expectations

- **Unit Tests**: < 100ms execution per test
- **Integration Tests**: < 5s per test suite (PGlite) or < 30s (pgTAP)
- **Build Time**: Optimal performance from modern, clean patterns

### 📊 Quality Metrics

- **Code Quality**: Lines of clean, maintainable code following patterns
- **Pattern Adoption**: Usage of SEED_TEST_IDS, worker-scoped testing, modern auth
- **Type Safety**: Full TypeScript inference with modern patterns
- **Memory Safety**: Zero dangerous PGlite patterns detected

---

## Post-Review Summary Template

### Overall Assessment

- **Status**: [PASS / FAIL]
- **Pattern Compliance**: [COMPLIANT / NEEDS_IMPROVEMENT]
- **Files Reviewed**: [Count and breakdown by category]
- **Quality Gates**: [TypeScript/ESLint/Tests/Build results]

### Critical Issues for Human Review

- **Memory Safety**: [Any dangerous PGlite patterns detected]
- **Schema Violations**: [Any attempts to modify locked schema]
- **Security Concerns**: [Organization scoping or permission issues]
- **Performance Impact**: [Potential performance impacts from changes]

### Pattern Compliance Summary

- **SEED_TEST_IDS**: [Usage across tests and mocks]
- **Worker-scoped Testing**: [Memory-safe integration test patterns]
- **Modern Auth**: [Supabase SSR usage, no deprecated helpers]
- **Organization Scoping**: [Multi-tenant data access patterns]

### Recommendations

- **Immediate Actions**: [Critical issues requiring attention]
- **Pattern Opportunities**: [Areas to improve pattern adoption]
- **Documentation Updates**: [Guide updates based on findings]

---

**This procedure ensures every code change advances PinPoint's architectural patterns while maintaining the highest standards for memory safety, security, performance, and developer experience.**
