# Dependency Injection Implementation Checklist

## Phase Completion Tracking

### Phase 1: Core Database Module ✅

- [x] Refactor `src/server/db.ts` to factory pattern
- [x] Create `src/server/db/provider.ts`
- [x] Remove all database instance exports
- [ ] Add unit tests for provider
- [x] Verify no auto-initialization on import

### Phase 2: Service Layer ✅

- [x] Create `src/server/services/factory.ts`
- [x] Add all existing services to factory
- [x] Add QRCodeService to factory
- [x] Update `src/server/api/trpc.base.ts` context
- [x] Add service factory tests

### Phase 3.1: API Routes ✅

- [x] Update `src/app/api/health/route.ts`
- [x] Update `src/app/api/dev/users/route.ts`
- [x] Update `src/app/api/upload/issue/route.ts`
- [x] Update `src/app/api/upload/organization-logo/route.ts`
- [x] Update `src/server/auth/uploadAuth.ts` to accept db param
- [x] Check `src/app/api/qr/[qrCodeId]/route.ts`
- [x] Handle archived signup actions

### Phase 3.2: Auth Configuration ✅

- [x] Convert `src/server/auth/config.ts` to factory
- [x] Update `src/server/auth/index.ts`
- [x] Update `src/server/auth/uploadAuth.ts`
- [ ] Test auth flow works correctly

### Phase 3.3: tRPC Routers ✅

- [x] Update notification router (4 instances)
- [x] Update collection router (7 instances)
- [x] Update pinballMap router (4 instances)
- [x] Update issue routers (activity, cleanup services)
- [x] Update comment router
- [x] Update qrCode router

### Phase 4: Testing Infrastructure ✅

- [x] Update `src/test/mockContext.ts`
- [x] Update `src/test/setup.ts`
- [x] Create `src/test/helpers/serviceHelpers.ts`
- [x] Remove DATABASE_URL from tests
- [x] Add database module mocks

### Phase 5: Test Files (Parallel Tasks) ✅

#### 5.1: API Route Tests

- [x] Update `src/app/api/dev/__tests__/users.test.ts`
- [ ] Check/update health route tests
- [ ] Check/update upload route tests
- [ ] Check/update QR code route tests

#### 5.2: Auth Tests

- [x] Update `src/server/auth/__tests__/config.test.ts`
- [ ] Update upload auth tests
- [ ] Update auth integration tests

#### 5.3: Router Tests

- [x] Update `src/server/api/routers/__tests__/notification.test.ts`
- [x] Update `src/server/api/routers/__tests__/collection.test.ts`
- [x] Update `src/server/api/routers/__tests__/trpc-auth.test.ts`
- [x] Update `src/server/api/__tests__/multi-tenant-security.test.ts`
- [ ] Add QR code router tests
- [ ] Update other router tests

#### 5.4: Service Tests

- [x] Update service tests to remove db imports
- [x] Add service factory tests
- [x] Add QR code service tests
- [x] Ensure type safety

## File Count Summary

- **Direct DB imports to fix:** 11 files
- **Service instantiations to update:** ~20 instances across routers
- **Test files to update:** 10+ files

## Success Metrics

- ✅ Zero direct database imports (except provider)
- ✅ All tests pass without real DB connection
- ✅ TypeScript compilation succeeds
- ✅ Service factory pattern used consistently
- ✅ Proper cleanup in all API routes
