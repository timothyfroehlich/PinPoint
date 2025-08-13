# AI-Powered Drizzle Migration Review Procedure (2025)

**Objective**: Comprehensive review checklist for direct Prisma-to-Drizzle migration optimized for solo development velocity and modern best practices.

**Context**:

- **Migration Approach**: Direct conversion without parallel validation infrastructure
- **Project Phase**: Solo development, pre-beta, velocity-optimized
- **Timeline**: 2-3 weeks vs 7+ weeks with parallel validation
- **Tech Stack**: August 2025 patterns (Drizzle, Supabase SSR, Vitest v4.0, Next.js App Router)

**Scope**: Individual files within Pull Requests that are part of the direct conversion migration.

---

## Pre-Review Analysis

### File Categorization

For each modified file, categorize as:

- `ROUTER`: tRPC router file (`src/server/api/routers/*.ts`)
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

### Category: `ROUTER` - Direct Conversion

#### 🚨 Critical Migration Requirements

- [ ] **Complete Prisma Elimination**: Zero Prisma usage remains
  - [ ] No `ctx.db` or `ctx.prisma` references
  - [ ] No Prisma imports (`@prisma/client`, `prisma.*`)
  - [ ] No parallel validation or comparison code
  - [ ] No Prisma-specific types or enums
- [ ] **Clean Drizzle Implementation**: All data access uses `ctx.drizzle` exclusively
- [ ] **TypeScript Compilation**: File builds without errors

#### 🗄️ Modern Drizzle Patterns (2025)

- [ ] **Relational Queries**: Uses `db.query.users.findMany({ with: { posts: true } })` for relationships
- [ ] **Generated Columns**: Computed fields migrated to `.generatedAlwaysAs()` in schema
- [ ] **Enhanced Index API**: Uses `.on(table.column.asc())` NOT old `.on(table.column).asc()`
- [ ] **Core Query Patterns**:
  - [ ] SELECTs use relational API or `db.select().from(...)`
  - [ ] INSERTs use `db.insert(table).values(...).returning()`
  - [ ] UPDATEs use `db.update(table).set(...).where(...)`
  - [ ] DELETEs use `db.delete(table).where(...)`
- [ ] **Advanced Features**:
  - [ ] Batch operations use `db.batch()` for performance
  - [ ] Frequently used queries implement `.prepare()`
  - [ ] PostgreSQL extensions (`vector`, `geometry`) use native types
  - [ ] Schema type inference uses `$inferSelect`/`$inferInsert`

#### 🔐 Security & Multi-Tenancy

- [ ] **Organization Scoping**: Every query includes `eq(table.organizationId, ctx.organizationId)`
- [ ] **Permission Validation**: Authorization logic preserved from original
- [ ] **Error Handling**: `TRPCError` patterns maintained for security
- [ ] **Input Validation**: Zod schemas properly validate all inputs

#### ⚡ Performance & Quality

- [ ] **Query Optimization**: Prepared statements, indexes, batch operations used appropriately
- [ ] **Type Safety**: Full TypeScript type safety throughout
- [ ] **Import Cleanup**: Only necessary Drizzle imports remain
- [ ] **Code Quality**: Clean, readable implementation without legacy patterns

---

### Category: `UNIT_TEST` - Modern Vitest Patterns (2025)

#### 🧪 Type-Safe Mocking Strategy

- [ ] **Modern Mocking Patterns**:
  - [ ] Uses `vi.mock` with async factory and `vi.importActual<typeof ModuleType>()`
  - [ ] Implements `vi.hoisted(() => ({ mockFn: vi.fn() }))` for shared state
  - [ ] Mocks at module level instead of individual methods
  - [ ] No manual chain mocking on `db.query.*` methods
- [ ] **PGlite Integration**:
  - [ ] Uses `@electric-sql/pglite` for in-memory PostgreSQL testing
  - [ ] Database module mocked in `vitest.setup.ts` with real schema
  - [ ] Migrations applied automatically in test setup

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

#### 🗄️ In-Memory Database Setup (Preferred)

- [ ] **PGlite Configuration**:
  - [ ] Uses `@electric-sql/pglite` for fast, isolated testing
  - [ ] Schema applied with `drizzle-orm/pglite/migrator`
  - [ ] Fresh database instance per test suite
  - [ ] Complete schema with relationships and indexes
- [ ] **Test Isolation**: Clean database state between tests (transaction rollback or fresh instance)

#### 🔍 High-Fidelity Validation

- [ ] **Real Query Execution**: Tests execute actual Drizzle queries against PostgreSQL
- [ ] **Database Constraints**: Validates UNIQUE constraints, foreign keys, cascades
- [ ] **Complex Operations**: Multi-table joins, aggregations, transactions tested
- [ ] **Performance Validation**: Query performance within acceptable limits

#### 🛠️ Alternative: Real Database

- [ ] **Environment Setup**: Dedicated test database with proper `.env.test` configuration
- [ ] **Schema Management**: Automated sync with `drizzle-kit generate && migrate`
- [ ] **Hard Failure**: Tests fail immediately when database unavailable (no silent skipping)

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

- [ ] **Migration Status**: Reflects **completed** migration (not "in progress")
- [ ] **Modern Patterns**: Comprehensive Drizzle ORM patterns and best practices
- [ ] **Current Examples**: All code examples use Drizzle syntax (no Prisma)
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

### ⏱️ Performance Expectations (2025)

- **Unit Tests**: < 100ms execution per test
- **Integration Tests**: < 5s per test suite (PGlite) or < 30s (real DB)
- **Component Tests**: < 1s per test
- **Build Time**: Noticeable improvement from cleaner codebase

### 📊 Migration Quality Metrics

- **Code Reduction**: Lines eliminated from parallel validation removal
- **Conversion Completeness**: Percentage of Prisma references eliminated
- **Modern Pattern Adoption**: Usage of relational queries, generated columns, enhanced indexes
- **Type Safety**: Migration to `$inferSelect`/`$inferInsert` patterns
- **Test Modernization**: Percentage using PGlite and `vi.importActual` patterns
- **Performance**: Query optimization through prepared statements and generated columns
- **Supabase SSR**: Complete migration from deprecated auth-helpers
- **Vitest v4.0**: Updated configuration and mocking patterns

---

## Post-Review Summary Template

### Overall Assessment

- **Status**: [PASS / FAIL]
- **Migration Compliance**: [DIRECT_CONVERSION_ALIGNED / NEEDS_ADJUSTMENT]
- **Files Reviewed**: [Count and breakdown by category]
- **Quality Gates**: [TypeScript/ESLint/Tests/Build results]

### File-by-File Results

**Router Files:**

- `[filename]`: [PASS/FAIL]
  - Prisma Removal: [COMPLETE/INCOMPLETE]
  - Modern Drizzle: [CLEAN/NEEDS_WORK]
  - File Impact: [X → Y lines (-Z%)]

**Test Files:**

- `[filename]`: [PASS/FAIL]
  - Testing Strategy: [MODERN_VITEST/LEGACY]
  - Mock Patterns: [TYPE_SAFE/MANUAL]
  - Performance: [ACCEPTABLE/SLOW]

### Critical Issues for Human Review

- **Complex Conversions**: [Files requiring manual validation]
- **Performance Concerns**: [Potential query performance impacts]
- **Testing Gaps**: [Missing coverage areas]
- **Security Considerations**: [Multi-tenancy or permission issues]

### Migration Success Indicators

- **Velocity Impact**: Expected improvement from cleaner codebase
- **Maintenance**: Reduction in validation infrastructure burden
- **Learning**: Direct Drizzle usage improving development knowledge
- **Type Safety**: Enhanced compile-time error catching

### Recommendations

- **Immediate Actions**: [Critical issues requiring attention]
- **Follow-up Tasks**: [Non-blocking improvements for future PRs]
- **Pattern Opportunities**: [Reusable patterns for other conversions]
- **Documentation**: [Guide updates based on conversion learnings]

---

**This enhanced review procedure ensures every migration PR advances the direct conversion strategy while maintaining code quality, security, and modern best practices aligned with August 2025 standards.**
