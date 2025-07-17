# Dependency Injection Implementation Checklist

## Phase Completion Tracking

### Phase 1: Core Database Module ⏳

- [ ] Refactor `src/server/db.ts` to factory pattern
- [ ] Create `src/server/db/provider.ts`
- [ ] Remove all database instance exports
- [ ] Add unit tests for provider
- [ ] Verify no auto-initialization on import

### Phase 2: Service Layer ⏳

- [ ] Create `src/server/services/factory.ts`
- [ ] Add all existing services to factory
- [ ] Add QRCodeService to factory
- [ ] Update `src/server/api/trpc.base.ts` context
- [ ] Add service factory tests

### Phase 3.1: API Routes ⏳

- [ ] Update `src/app/api/health/route.ts`
- [ ] Update `src/app/api/dev/users/route.ts`
- [ ] Update `src/app/api/upload/issue/route.ts`
- [ ] Update `src/app/api/upload/organization-logo/route.ts`
- [ ] Update `src/server/auth/uploadAuth.ts` to accept db param
- [ ] Check `src/app/api/qr/[qrCodeId]/route.ts`
- [ ] Handle archived signup actions

### Phase 3.2: Auth Configuration ⏳

- [ ] Convert `src/server/auth/config.ts` to factory
- [ ] Update `src/server/auth/index.ts`
- [ ] Update `src/server/auth/uploadAuth.ts`
- [ ] Test auth flow works correctly

### Phase 3.3: tRPC Routers ⏳

- [ ] Update notification router (4 instances)
- [ ] Update collection router (7 instances)
- [ ] Update pinballMap router (4 instances)
- [ ] Update issue routers (activity, cleanup services)
- [ ] Update comment router
- [ ] Update qrCode router

### Phase 4: Testing Infrastructure ⏳

- [ ] Update `src/test/mockContext.ts`
- [ ] Update `src/test/setup.ts`
- [ ] Create `src/test/helpers/serviceHelpers.ts`
- [ ] Remove DATABASE_URL from tests
- [ ] Add database module mocks

### Phase 5: Test Files (Parallel Tasks) ⏳

#### 5.1: API Route Tests

- [ ] Update `src/app/api/dev/__tests__/users.test.ts`
- [ ] Check/update health route tests
- [ ] Check/update upload route tests
- [ ] Check/update QR code route tests

#### 5.2: Auth Tests

- [ ] Update `src/server/auth/__tests__/config.test.ts`
- [ ] Update upload auth tests
- [ ] Update auth integration tests

#### 5.3: Router Tests

- [ ] Update `src/server/api/routers/__tests__/notification.test.ts`
- [ ] Update `src/server/api/routers/__tests__/collection.test.ts`
- [ ] Update `src/server/api/routers/__tests__/trpc-auth.test.ts`
- [ ] Update `src/server/api/__tests__/multi-tenant-security.test.ts`
- [ ] Add QR code router tests
- [ ] Update other router tests

#### 5.4: Service Tests

- [ ] Update service tests to remove db imports
- [ ] Add service factory tests
- [ ] Add QR code service tests
- [ ] Ensure type safety

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
