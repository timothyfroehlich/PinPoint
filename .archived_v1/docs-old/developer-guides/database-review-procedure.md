# Database & Testing Code Review Procedure (2025)

**Objective**: Comprehensive review checklist for modern database architecture and testing patterns using August 2025 best practices.

**Context**:

- **Tech Stack**: August 2025 patterns (Drizzle ORM, Supabase SSR, Vitest v4.0, Next.js App Router)
- **Focus**: Database optimization, testing quality, performance, and security
- **Standards**: Modern full-stack development with comprehensive testing

**Scope**: Database-related files, testing infrastructure, and quality assurance within Pull Requests.

---

## Pre-Review Analysis

### File Categorization

For each modified file, categorize as:

- `DATABASE_SCHEMA`: Database schema file (`src/server/db/schema/*.ts`)
- `ROUTER`: tRPC router file (`src/server/api/routers/*.ts`)
- `SERVICE`: Business logic service (`src/server/services/*.ts`)
- `UNIT_TEST`: Unit test with mocked dependencies (`src/**/*.test.ts`)
- `INTEGRATION_TEST`: Integration test with PGlite database (`src/**/*.integration.test.ts`)
- `COMPONENT_TEST`: UI component test with MSW-tRPC patterns (`src/**/*.component.test.tsx`)
- `SERVER_COMPONENT_TEST`: Next.js async server component test (`src/**/*.server.test.tsx`)
- `MOCK_FACTORY`: Test mock factory (`src/test/factories/*`)
- `SERVER_ACTION`: Next.js Server Actions file (`src/app/actions/*.ts`)
- `SERVER_COMPONENT`: Next.js Server Component (`src/app/**/*.tsx`)
- `GUIDE`: Documentation file (`docs/**/*.md`)
- `OTHER`: Any other file type

---

## Automated Review Checklist

### Category: `DATABASE_SCHEMA` - Modern Schema Design

#### 🗄️ August 2025 Drizzle Patterns

- [ ] **Generated Columns**: Computed fields use `.generatedAlwaysAs()` for database-level calculations
- [ ] **Enhanced Index API**: Uses `.on(table.column.asc())` NOT old `.on(table.column).asc()`
- [ ] **Type Inference**: Uses `$inferSelect`/`$inferInsert` for schema type safety
- [ ] **PostgreSQL Extensions**: Native types for vector/geometry where applicable
- [ ] **Relationships**: Proper foreign key constraints and relational query support

#### 🔐 Security & Performance

- [ ] **Multi-Tenant Structure**: Organizational scoping columns present where needed
- [ ] **Index Optimization**: Appropriate indexes for common query patterns
- [ ] **Data Integrity**: Proper constraints and validation at database level
- [ ] **Performance Considerations**: Efficient data types and structure

---

### Category: `ROUTER` - Database Integration

#### 🗄️ Modern Drizzle Implementation

- [ ] **Relational Queries**: Uses `db.query.users.findMany({ with: { posts: true } })` for relationships
- [ ] **Core Query Patterns**:
  - [ ] SELECTs use relational API or `db.select().from(...)`
  - [ ] INSERTs use `db.insert(table).values(...).returning()`
  - [ ] UPDATEs use `db.update(table).set(...).where(...)`
  - [ ] DELETEs use `db.delete(table).where(...)`
- [ ] **Performance Features**:
  - [ ] Frequently used queries implement `.prepare()`
  - [ ] Batch operations use `db.batch()` for efficiency
  - [ ] Partial column selection to reduce over-fetching

#### 🔐 Security & Multi-Tenancy

- [ ] **Organization Scoping**: Every query includes `eq(table.organizationId, ctx.organizationId)`
- [ ] **Permission Validation**: Authorization logic properly implemented
- [ ] **Error Handling**: `TRPCError` patterns maintained for security
- [ ] **Input Validation**: Zod schemas properly validate all inputs

#### ⚡ Quality & Performance

- [ ] **Type Safety**: Full TypeScript type safety throughout
- [ ] **Query Optimization**: Prepared statements, indexes, batch operations used appropriately
- [ ] **Code Quality**: Clean, readable implementation following modern patterns

---

### Category: `SERVICE` - Business Logic Layer

#### 🏗️ Modern Architecture Patterns

- [ ] **Dependency Injection**: Clean service constructor patterns
- [ ] **Database Integration**: Proper Drizzle client usage
- [ ] **Error Handling**: Comprehensive error handling with proper typing
- [ ] **Business Logic Separation**: Clear separation between data access and business rules

#### 🔐 Security Integration

- [ ] **Authorization**: Proper permission checking and organizational scoping
- [ ] **Data Validation**: Input validation at service layer
- [ ] **Audit Logging**: Security-relevant operations logged appropriately

---

### Category: `UNIT_TEST` - Modern Vitest Patterns (2025)

#### 🧪 Type-Safe Mocking Strategy

- [ ] **Modern Mocking Patterns**:
  - [ ] Uses `vi.mock` with async factory and `vi.importActual<typeof ModuleType>()`
  - [ ] Implements `vi.hoisted(() => ({ mockFn: vi.fn() }))` for shared state
  - [ ] Mocks at module level instead of individual methods
  - [ ] No manual chain mocking on `db.query.*` methods

#### 🔒 Authentication & Context Mocking

- [ ] **Supabase SSR Mocking**: Mocks `@supabase/ssr` (NOT deprecated auth-helpers)
- [ ] **tRPC Context**: Proper context mocking with user sessions and organization scoping
- [ ] **Mock Lifecycle**: Uses `vi.clearAllMocks()` and `vi.resetModules()` appropriately

#### 📊 Test Quality Standards

- [ ] **AAA Pattern**: Clear Arrange, Act, Assert structure
- [ ] **Comprehensive Scenarios**: Success, failure, validation, and permission cases
- [ ] **Performance**: Unit tests complete under 100ms each
- [ ] **Type Safety**: All mocks properly typed with schema inference

---

### Category: `INTEGRATION_TEST` - PGlite Database Testing

#### 🚨 CRITICAL: Memory Pattern Validation (MANDATORY)

- [ ] **🔴 BLOCKING**: Uses worker-scoped database pattern (NOT per-test instances)
  - [ ] ❌ FORBIDDEN: `createSeededTestDatabase()` in `beforeEach()` or per-test
  - [ ] ❌ FORBIDDEN: `new PGlite()` in individual tests
  - [ ] ❌ FORBIDDEN: Multiple database instances per test file
  - [ ] ✅ REQUIRED: `import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db"`
  - [ ] ✅ REQUIRED: `test("...", async ({ workerDb }) => await withIsolatedTest(workerDb, ...))`
- [ ] **🔴 Memory Impact Assessment**:
  - [ ] Count of integration tests using old pattern: **0** (must be zero)
  - [ ] Estimated memory usage: **< 200MB total** (worker-scoped pattern)
  - [ ] No evidence of per-test PGlite instance creation

#### 🗄️ In-Memory Database Setup (Worker-Scoped Only)

- [ ] **PGlite Configuration**:
  - [ ] Uses `@electric-sql/pglite` with worker-scoped fixtures
  - [ ] Schema applied with `drizzle-orm/pglite/migrator` once per worker
  - [ ] **SHARED** database instance per worker process (NOT per test)
  - [ ] Complete schema with relationships and indexes
- [ ] **Test Isolation**: Transaction cleanup via `withIsolatedTest()` helper

#### 🔍 High-Fidelity Validation

- [ ] **Real Query Execution**: Tests execute actual Drizzle queries against PostgreSQL
- [ ] **Database Constraints**: Validates UNIQUE constraints, foreign keys, cascades
- [ ] **Complex Operations**: Multi-table joins, aggregations, transactions tested
- [ ] **Performance Validation**: Query performance within acceptable limits

---

### Category: `COMPONENT_TEST` - UI with Modern MSW-tRPC

#### 🌐 MSW-tRPC Integration (v2.0.1)

- [ ] **Modern Configuration**: Uses `links` array configuration for MSW-tRPC v2.0.1
- [ ] **Type-Safe Mocking**: Uses `vi.importActual<typeof ModuleType>()` for React preservation
- [ ] **Provider Setup**: tRPC client with transformer configuration matching server
- [ ] **Request Interception**: MSW handlers properly intercept and mock tRPC calls

#### 🔐 Authentication Integration

- [ ] **Supabase SSR Mocking**: Mocks `@supabase/ssr` client creation for auth components
- [ ] **VitestTestWrapper**: Uses auth integration wrapper for permission testing
- [ ] **Session States**: Tests multiple auth states (authenticated, unauthenticated, different roles)

#### 🎯 Component Testing Best Practices

- [ ] **Semantic Queries**: Uses `getByRole`, `getByLabelText` over brittle selectors
- [ ] **User Interactions**: Real user events with `@testing-library/user-event`
- [ ] **Integration Focus**: Tests real components with controlled data
- [ ] **Performance**: Component tests complete under 1000ms

---

### Category: `SERVER_COMPONENT_TEST` - Next.js App Router Testing

#### ⚡ Modern Server Component Patterns

- [ ] **Direct Testing**: Tests async Server Component as function (`await Component({ params })`)
- [ ] **Data Validation**: Verifies correct Drizzle database queries and data retrieval
- [ ] **JSX Inspection**: Tests returned JSX structure and props
- [ ] **Error Boundaries**: Tests not-found and error scenarios with proper error handling
- [ ] **Server Actions**: Tests form submissions that call Server Actions

#### 🛠️ Environment & Mocking

- [ ] **Next.js Mocking**: `vi.mock('next/headers')` with cookie utilities
- [ ] **Supabase SSR**: Mocks server client creation and auth methods properly
- [ ] **Database Integration**: PGlite OR comprehensive Drizzle query mocks
- [ ] **Auth Context**: Simulated server-side auth using Supabase SSR patterns
- [ ] **Server Actions**: Mocks with `vi.mock('@/app/actions')`

---

### Category: `SERVER_ACTION` - Next.js Server Actions

#### 🔒 Authentication & Authorization

- [ ] **Supabase Integration**: Uses `@supabase/ssr` for server-side auth
- [ ] **Auth Validation**: Proper user authentication and session handling
- [ ] **Organization Scoping**: Multi-tenant data access properly scoped
- [ ] **Permission Checks**: Role-based access control implemented

#### 📥 Input Validation & Processing

- [ ] **FormData Handling**: Proper extraction and validation of form data
- [ ] **Zod Validation**: Input schemas validate all form fields
- [ ] **Error Handling**: Graceful error handling with user-friendly messages
- [ ] **Type Safety**: Full TypeScript type safety throughout

#### ⚡ Performance & UX

- [ ] **Database Operations**: Efficient Drizzle queries with proper scoping
- [ ] **Cache Invalidation**: Uses `revalidatePath()` or `revalidateTag()` appropriately
- [ ] **Redirect Handling**: Proper redirects on success/error states
- [ ] **Loading States**: Consideration for UI loading and pending states

---

### Category: `SERVER_COMPONENT` - Next.js Server Components

#### 🔄 Data Fetching Patterns

- [ ] **Direct Database Access**: Uses Drizzle database client directly in component
- [ ] **Async Structure**: Component properly handles async database operations
- [ ] **Error Handling**: Implements proper error boundaries and not-found pages
- [ ] **Performance**: Efficient queries with minimal over-fetching

#### 🔐 Authentication & Security

- [ ] **Server Auth**: Uses `@supabase/ssr` for server-side authentication
- [ ] **Organization Scoping**: All queries properly scoped to user's organization
- [ ] **Permission Checks**: Renders content based on user permissions
- [ ] **Security Headers**: Considers security implications of server rendering

---

### Category: `MOCK_FACTORY` - Test Infrastructure

#### 🧪 Modern Mock Implementation (Vitest 2025)

- [ ] **Hoisted Objects**: Uses `vi.hoisted(() => ({ mockDb: {...} }))` pattern
- [ ] **Type Safety**: Strongly typed to match Drizzle client with `$inferSelect`
- [ ] **PGlite Integration**: Optional real PGlite instance for high-fidelity testing
- [ ] **Setup Methods**: `setup(initialData)` with schema validation

#### ⚡ Advanced Features

- [ ] **Relational Support**: Handles `with` queries and `db.query` API
- [ ] **Query Operators**: Implements `eq`, `and`, `inArray` with proper typing
- [ ] **Transaction Support**: Simulates `db.transaction()` callback patterns
- [ ] **Generated Columns**: Correctly handles computed fields
- [ ] **Supabase Integration**: Mocks Supabase client alongside database

---

### Category: `GUIDE` - Documentation Updates

#### 📝 Content Accuracy & Completeness

- [ ] **Current Standards**: Reflects modern development practices (not outdated)
- [ ] **Modern Patterns**: Comprehensive database and testing best practices
- [ ] **Current Examples**: All code examples use modern syntax
- [ ] **Testing Updates**: Modern testing infrastructure (PGlite, Vitest v4.0)

#### 🎯 Technical Coverage

- [ ] **Schema Patterns**: Type inference, generated columns, enhanced indexes
- [ ] **Query Syntax**: Relational queries, prepared statements, batch operations
- [ ] **Security Patterns**: Multi-tenancy, organization scoping, permission validation
- [ ] **Performance**: Query optimization and modern performance patterns
- [ ] **Supabase Integration**: SSR package usage, Server Components/Actions patterns

---

## Quality Gates & Validation

### 🔍 Mandatory Validation Steps

For each modified file, ensure:

- [ ] **TypeScript Compilation**: `npm run typecheck:brief` passes without errors
- [ ] **ESLint Compliance**: `npm run lint:brief` passes without violations
- [ ] **Test Execution**: All relevant tests pass using modern patterns
- [ ] **Build Success**: `npm run build` completes successfully (if applicable)
- [ ] **Supabase SSR**: No usage of deprecated `@supabase/auth-helpers`
- [ ] **Vitest Configuration**: Uses `projects` config (not deprecated `workspace`)

### 🚨 CRITICAL: Memory Pattern Validation (Integration Tests)

**MANDATORY FOR ALL INTEGRATION TEST FILES:**

- [ ] **Memory Safety Audit**: `grep -r "createSeededTestDatabase\\|new PGlite" src/integration-tests/` returns **ZERO results**
- [ ] **Worker-Scoped Pattern**: All integration tests use `import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db"`
- [ ] **Memory Estimation**: Maximum 1-2 PGlite instances (worker-scoped) vs 10+ instances (per-test)
- [ ] **System Impact**: No risk of 1-2GB+ memory consumption causing system lockups

### ⏱️ Performance Expectations (2025)

- **Unit Tests**: < 100ms execution per test
- **Integration Tests**: < 5s per test suite (PGlite) or < 30s (real DB)
- **Component Tests**: < 1s per test
- **Build Time**: Optimal performance from clean, modern codebase

### 📊 Quality Metrics

- **Code Quality**: Lines of clean, maintainable code vs legacy patterns
- **Modern Pattern Adoption**: Usage of relational queries, generated columns, enhanced indexes
- **Type Safety**: Full TypeScript inference with modern patterns
- **Test Modernization**: Percentage using PGlite and `vi.importActual` patterns
- **Performance**: Query optimization through prepared statements and database-level features
- **Supabase SSR**: Modern authentication patterns throughout
- **Vitest v4.0**: Updated configuration and mocking patterns

---

## Post-Review Summary Template

### Overall Assessment

- **Status**: [PASS / FAIL]
- **Quality Compliance**: [MODERN_STANDARDS_ALIGNED / NEEDS_IMPROVEMENT]
- **Files Reviewed**: [Count and breakdown by category]
- **Quality Gates**: [TypeScript/ESLint/Tests/Build results]

### File-by-File Results

**Database Files:**

- `[filename]`: [PASS/FAIL]
  - Modern Patterns: [CURRENT/OUTDATED]
  - Performance: [OPTIMIZED/NEEDS_WORK]
  - Security: [COMPLIANT/GAPS]

**Test Files:**

- `[filename]`: [PASS/FAIL]
  - Testing Strategy: [MODERN_PATTERNS/LEGACY]
  - Mock Patterns: [TYPE_SAFE/MANUAL]
  - Performance: [ACCEPTABLE/SLOW]

**Integration Test Files (Memory Assessment):**

- `[filename]`: [PASS/FAIL]
  - Memory Pattern: [WORKER_SCOPED/DANGEROUS_PER_TEST]
  - PGlite Usage: [SHARED_INSTANCE/INDIVIDUAL_INSTANCES]
  - Memory Impact: [SAFE_<200MB/CRITICAL_>1GB]
  - Pattern Status: [MODERN_COMPLIANT/NEEDS_UPDATE]

### Critical Issues for Human Review

- **Performance Concerns**: [Potential query performance impacts]
- **Testing Gaps**: [Missing coverage areas]
- **Security Considerations**: [Multi-tenancy or permission issues]
- **Memory Safety**: [Integration test patterns requiring attention]

### Quality Indicators

- **Performance Impact**: Expected improvement from modern patterns
- **Maintainability**: Reduction in technical debt through modern practices
- **Developer Experience**: Improved type safety and testing reliability
- **Scalability**: Enhanced performance and architectural patterns

### Recommendations

- **Immediate Actions**: [Critical issues requiring attention]
- **Follow-up Tasks**: [Non-blocking improvements for future work]
- **Pattern Opportunities**: [Reusable patterns for other development]
- **Documentation**: [Guide updates based on learnings]

---

**This comprehensive review procedure ensures every database and testing change advances modern development practices while maintaining the highest standards for code quality, security, performance, and developer experience aligned with August 2025 standards.**
