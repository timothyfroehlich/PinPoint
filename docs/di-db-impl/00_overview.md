# Dependency Injection Implementation Overview

## Goal

Complete refactoring of database access to use dependency injection pattern throughout the codebase, eliminating all direct imports of database instances.

## Phases and Dependencies

### Phase 1: Core Database Module (MUST BE DONE FIRST)

- Refactor `src/server/db.ts` to factory pattern
- Create database provider class
- **Blocker for all other phases**

### Phase 2: Service Layer Standardization (DEPENDS ON PHASE 1)

- Create service factory
- Update tRPC context to include service factory
- **Blocker for Phase 3.3 and Phase 4**

### Phase 3: Parallel Refactors (CAN BE DONE IN PARALLEL AFTER PHASE 2)

- 3.1: API Routes refactoring
- 3.2: Auth configuration refactoring
- 3.3: tRPC routers to use service factory

### Phase 4: Testing Infrastructure (DEPENDS ON PHASE 2)

- Update mock context
- Remove database URLs from test setup
- Create test utilities

### Phase 5: Update Test Files (DEPENDS ON PHASE 4)

- Update all test files to use new patterns
- Can be done incrementally

## Files Affected

### Direct Database Imports (11 files)

1. `src/app/api/dev/users/route.ts`
2. `src/app/api/health/route.ts`
3. `src/app/api/upload/issue/route.ts`
4. `src/app/api/upload/organization-logo/route.ts`
5. `src/server/api/trpc.base.ts`
6. `src/server/auth/config.ts`
7. `src/server/auth/uploadAuth.ts`
8. `src/_archived_frontend/signup/actions.ts`
9. Test files (3)

### Service Classes (8 services)

1. `NotificationService`
2. `CollectionService`
3. `PinballMapService`
4. `IssueActivityService`
5. `CommentCleanupService`
6. `QRCodeService` (NEW)
7. Others in services directory

### tRPC Routers

- All routers that instantiate services directly
- Approximately 20+ router files

## Success Metrics

1. Zero direct imports of database instance
2. All tests pass without real database connections
3. Type safety maintained
4. Clear dependency flow
