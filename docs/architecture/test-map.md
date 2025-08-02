# PinPoint Test File Map

This document maps test files to the specific source files they test, organized by test type and coverage areas.

## Test Organization Strategy

- **Unit Tests**: Individual function/module testing with mocked dependencies
- **Integration Tests**: Full-stack feature testing with real database interactions
- **End-to-End Tests**: Complete user workflow testing via browser automation

## Unit Tests

### API Router Tests

| Test File                                     | Source Files Tested                      | Coverage Focus                                 |
| --------------------------------------------- | ---------------------------------------- | ---------------------------------------------- |
| `src/server/api/routers/auth.test.ts`         | `src/server/api/routers/auth.ts`         | Authentication procedures, session management  |
| `src/server/api/routers/issue.test.ts`        | `src/server/api/routers/issue.ts`        | Issue CRUD operations, organization scoping    |
| `src/server/api/routers/machine.test.ts`      | `src/server/api/routers/machine.ts`      | Machine management, OPDB integration           |
| `src/server/api/routers/location.test.ts`     | `src/server/api/routers/location.ts`     | Location operations, multi-tenancy             |
| `src/server/api/routers/comment.test.ts`      | `src/server/api/routers/comment.ts`      | Comment CRUD, soft delete functionality        |
| `src/server/api/routers/upload.test.ts`       | `src/server/api/routers/upload.ts`       | File upload security, storage operations       |
| `src/server/api/routers/notification.test.ts` | `src/server/api/routers/notification.ts` | Notification triggers, delivery logic          |
| `src/server/api/routers/organization.test.ts` | `src/server/api/routers/organization.ts` | Organization management, role permissions      |
| `src/server/api/routers/user.test.ts`         | `src/server/api/routers/user.ts`         | User profile operations, membership management |

### Library Function Tests

| Test File                              | Source Files Tested               | Coverage Focus                               |
| -------------------------------------- | --------------------------------- | -------------------------------------------- |
| `src/lib/auth.test.ts`                 | `src/lib/auth.ts`                 | NextAuth configuration, provider setup       |
| `src/lib/upload.test.ts`               | `src/lib/upload.ts`               | File handling utilities, storage abstraction |
| `src/lib/permissions.test.ts`          | `src/lib/permissions.ts`          | Permission checking logic, role validation   |
| `src/lib/validations/issue.test.ts`    | `src/lib/validations/issue.ts`    | Issue validation schemas, input sanitization |
| `src/lib/validations/machine.test.ts`  | `src/lib/validations/machine.ts`  | Machine validation, OPDB data transformation |
| `src/lib/validations/location.test.ts` | `src/lib/validations/location.ts` | Location validation, geocoding utilities     |
| `src/lib/validations/comment.test.ts`  | `src/lib/validations/comment.ts`  | Comment validation, content filtering        |
| `src/lib/validations/user.test.ts`     | `src/lib/validations/user.ts`     | User profile validation, email normalization |

### External Integration Tests

| Test File                             | Source Files Tested              | Coverage Focus                                       |
| ------------------------------------- | -------------------------------- | ---------------------------------------------------- |
| `src/lib/external/opdb.test.ts`       | `src/lib/external/opdb.ts`       | OPDB API client, data transformation, error handling |
| `src/lib/external/pinballmap.test.ts` | `src/lib/external/pinballmap.ts` | PinballMap API integration, sync logic               |

### Utility and Helper Tests

| Test File                   | Source Files Tested    | Coverage Focus                                |
| --------------------------- | ---------------------- | --------------------------------------------- |
| `src/utils/version.test.ts` | `src/utils/version.ts` | Version utilities, build information          |
| `src/server/db.test.ts`     | `src/server/db.ts`     | Database connection, Prisma extensions        |
| `src/env.test.ts`           | `src/env.js`           | Environment validation, configuration loading |

## Integration Tests

### Full-Stack Feature Tests

| Test File                                           | Components Tested              | Coverage Focus                                  |
| --------------------------------------------------- | ------------------------------ | ----------------------------------------------- |
| `src/integration-tests/issue-management.test.ts`    | Issue router + DB + Auth       | Complete issue lifecycle, multi-tenancy         |
| `src/integration-tests/machine-management.test.ts`  | Machine router + DB + OPDB     | Machine operations, external data sync          |
| `src/integration-tests/comment-soft-delete.test.ts` | Comment router + DB            | Soft delete functionality, audit trails         |
| `src/integration-tests/notification.schema.test.ts` | Notification system + DB       | Notification triggers, schema validation        |
| `src/integration-tests/multi-tenancy.test.ts`       | All routers + DB + Auth        | Organization isolation, cross-tenant prevention |
| `src/integration-tests/file-upload.test.ts`         | Upload router + Storage + Auth | File security, organization scoping             |
| `src/integration-tests/opdb-sync.test.ts`           | OPDB integration + DB          | External API sync, data consistency             |
| `src/integration-tests/pinballmap-sync.test.ts`     | PinballMap integration + DB    | Location/machine sync, conflict resolution      |
| `src/integration-tests/dashboard.test.ts`           | Analytics router + DB          | Dashboard data accuracy, performance            |

### Authentication & Authorization Tests

| Test File                                         | Components Tested              | Coverage Focus                     |
| ------------------------------------------------- | ------------------------------ | ---------------------------------- |
| `src/integration-tests/auth-flow.test.ts`         | Auth system + Middleware + DB  | Login/logout, session management   |
| `src/integration-tests/role-permissions.test.ts`  | Permission system + DB         | RBAC enforcement, role inheritance |
| `src/integration-tests/subdomain-routing.test.ts` | Middleware + Organization + DB | Subdomain-to-org mapping, routing  |

## End-to-End Tests

### User Workflow Tests

| Test File                        | User Journeys Tested                       | Coverage Focus                        |
| -------------------------------- | ------------------------------------------ | ------------------------------------- |
| `e2e/dashboard.spec.ts`          | Dashboard navigation, overview widgets     | User interface, data visualization    |
| `e2e/issue-lifecycle.spec.ts`    | Create → Assign → Update → Resolve issue   | Complete issue management workflow    |
| `e2e/machine-management.spec.ts` | Add machine → Create issues → View history | Machine operations, issue association |
| `e2e/file-uploads.spec.ts`       | Issue creation with photo attachments      | File upload UI, security validation   |
| `e2e/multi-tenant.spec.ts`       | Cross-organization data isolation          | Tenant boundary enforcement           |
| `e2e/auth-flows.spec.ts`         | Login, logout, role switching              | Authentication user experience        |

### Admin Workflow Tests

| Test File                        | Admin Journeys Tested                  | Coverage Focus                         |
| -------------------------------- | -------------------------------------- | -------------------------------------- |
| `e2e/organization-setup.spec.ts` | Organization creation, user management | Admin functionality, setup workflows   |
| `e2e/role-management.spec.ts`    | Role assignment, permission changes    | RBAC administration                    |
| `e2e/data-import.spec.ts`        | OPDB sync, bulk machine import         | Data management, external integrations |

## Test Utilities and Setup

### Shared Test Infrastructure

| File                      | Purpose                               | Used By                   |
| ------------------------- | ------------------------------------- | ------------------------- |
| `src/test/setup.ts`       | Global test configuration, Jest setup | All test files            |
| `src/test/context.ts`     | tRPC context mocking utilities        | Router unit tests         |
| `src/test/mockContext.ts` | Database and auth mocking             | Integration tests         |
| `src/test/factories/`     | Test data factories and builders      | All test types            |
| `src/test/fixtures/`      | Static test data and samples          | Integration and E2E tests |

### Mock Implementations

| File                             | Mocks                      | Used By                       |
| -------------------------------- | -------------------------- | ----------------------------- |
| `src/__mocks__/next-auth.ts`     | NextAuth.js authentication | Unit tests requiring auth     |
| `src/__mocks__/prisma.ts`        | Database operations        | Unit tests with DB operations |
| `src/__mocks__/external-apis.ts` | OPDB, PinballMap APIs      | Integration tests             |

## Test Coverage Targets

### Global Minimums

- **Overall**: 50% statement coverage
- **Server directory**: 60% statement coverage
- **Lib directory**: 70% statement coverage

### Critical Path Coverage

- **Authentication flows**: 100%
- **Multi-tenant isolation**: 100%
- **Data validation**: 100%
- **Permission enforcement**: 100%
- **File upload security**: 100%

### Feature-Specific Targets

| Feature            | Target Coverage | Key Test Files                                  |
| ------------------ | --------------- | ----------------------------------------------- |
| Issue Management   | 85%             | `issue.test.ts`, `issue-management.test.ts`     |
| Machine Management | 80%             | `machine.test.ts`, `machine-management.test.ts` |
| Authentication     | 95%             | `auth.test.ts`, `auth-flow.test.ts`             |
| Multi-Tenancy      | 100%            | `multi-tenancy.test.ts`, `organization.test.ts` |
| File Uploads       | 90%             | `upload.test.ts`, `file-upload.test.ts`         |
| External APIs      | 75%             | `opdb.test.ts`, `pinballmap.test.ts`            |

## Database Migration Tests (Phase 2A)

### Drizzle ORM Test Coverage

| Test File                                                 | Source Files Tested                             | Coverage Focus                                |
| --------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| `src/server/db/drizzle-crud-validation.test.ts`          | `src/server/db/schema/*`, `src/server/db/drizzle.ts` | CRUD operations, transactions, multi-tenancy  |
| `src/server/api/routers/__tests__/drizzle-integration.test.ts` | `src/server/api/trpc.base.ts`, `src/test/vitestMockContext.ts` | tRPC + Drizzle integration, dual-ORM support |

### Test Statistics

- **27 CRUD tests**: INSERT (5), SELECT (4), UPDATE (3), DELETE (3), Transactions (3), Multi-tenancy (9)
- **12 integration tests**: Context validation (3), Schema exports (3), Error handling (2), Type safety (2), Mock validation (2)
- **Total Phase 2A tests**: 39 comprehensive tests validating foundation

### Key Test Patterns

- **Dual-ORM mocking**: Both Prisma and Drizzle clients in test context
- **Transaction testing**: Rollback scenarios and constraint violations
- **Multi-tenant isolation**: Cross-organization data access prevention
- **Type safety validation**: Full TypeScript strictest mode compliance

## Test Execution Commands

```bash
# Run all tests with coverage
npm run test:coverage

# Run specific test types
npm test -- --testPathPattern="unit"
npm test -- --testPathPattern="integration"
npm test -- --testPathPattern="e2e"

# Run Drizzle-specific tests
npm test drizzle-crud-validation
npm test drizzle-integration

# Run tests for specific feature
npm test -- --testNamePattern="issue"
npm test -- --testNamePattern="machine"

# Watch mode for development
npm test -- --watch

# Coverage for specific directory
npx jest --coverage --collectCoverageFrom="src/server/**/*.ts"
```

## Test Maintenance Notes

- **Update Frequency**: Test map updated after each completed task
- **Coverage Monitoring**: Automated coverage reporting in CI/CD
- **Test Quality**: All tests must use typed mocks, never `any`
- **Integration Guidelines**: Database tests require exceptional justification
- **E2E Stability**: Browser tests run against consistent test data

---

_This map is maintained by the orchestrator agent and updated after each completed task._
