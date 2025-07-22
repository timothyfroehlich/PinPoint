# Migration Status

## Migrated Tests
- [x] src/lib/opdb/__tests__/utils.vitest.test.ts ✅
- [x] src/server/services/__tests__/factory.vitest.test.ts ✅
- [x] src/server/db/__tests__/provider.vitest.test.ts ✅
- [x] src/server/auth/__tests__/config.vitest.test.ts ✅

## Tests to Migrate

### API Tests
- [ ] src/app/api/dev/__tests__/users-simple.test.ts
- [ ] src/app/api/dev/__tests__/users.test.ts
- [ ] src/app/api/upload/__tests__/upload-security.test.ts

### Integration Tests
- [ ] src/integration-tests/notification.schema.test.ts

### Library Tests
- [x] src/lib/opdb/__tests__/utils.test.ts → utils.vitest.test.ts ✅
- [ ] src/lib/pinballmap/__tests__/client.test.ts

### Server API Tests
- [ ] src/server/api/__tests__/multi-tenant-security.test.ts
- [ ] src/server/api/__tests__/trpc-auth.test.ts
- [ ] src/server/api/routers/__tests__/collection.test.ts
- [ ] src/server/api/routers/__tests__/issue.notification.test.ts
- [ ] src/server/api/routers/__tests__/notification.test.ts
- [ ] src/server/api/routers/__tests__/pinballmap-integration.test.ts

### Server Auth Tests
- [ ] src/server/auth/__tests__/auth-simple.test.ts
- [x] src/server/auth/__tests__/config.test.ts → config.vitest.test.ts ✅

### Server Database Tests
- [x] src/server/db/__tests__/provider.test.ts → provider.vitest.test.ts ✅

### Server Service Tests
- [ ] src/server/services/__tests__/collectionService.test.ts
- [x] src/server/services/__tests__/factory.test.ts → factory.vitest.test.ts ✅
- [ ] src/server/services/__tests__/notificationPreferences.test.ts
- [ ] src/server/services/__tests__/notificationService.test.ts
- [ ] src/server/services/__tests__/pinballmapService.test.ts

## Migration Strategy

1. Tests will be copied to `.vitest.test.ts` files
2. Original Jest tests remain untouched
3. Once verified, Jest tests can be removed
4. Start with utility/library tests (lowest risk)
5. Progress to server tests (Node environment)
6. Handle any React component tests (jsdom environment)

## Progress Tracking

- **Total Tests**: 20
- **Migrated**: 4
- **Remaining**: 16
- **Success Rate**: 20%

## Performance Results

### OPDB Utils Test (15 test cases)
- **Jest**: 0.658s (execution) / 1.561s (total)
- **Vitest**: 0.010s (execution) / 1.601s (total)
- **Test Execution Improvement**: 65x faster
- **Note**: Total time similar due to startup overhead for single test file

### Service Factory Test (6 test cases)
- **Jest**: 0.539s (execution) / 1.070s (total)  
- **Vitest**: 0.014s (execution) / 1.228s (total)
- **Test Execution Improvement**: 38x faster
- **Note**: Required additional mocks for dependencies in Vitest

### Database Provider Test (2 test cases)
- **Jest**: ~6ms (execution) / 0.381s (total)
- **Vitest**: 2ms (execution) / 0.568s (total)
- **Test Execution Improvement**: 3x faster
- **Note**: Simple test, minimal mocking required

### Auth Config Test (11 test cases)
- **Jest**: ~310ms (execution) / 0.724s (total)
- **Vitest**: 42ms (execution) / 1.85s (total)
- **Test Execution Improvement**: 7x faster
- **Note**: Complex NextAuth mocking with vi.hoisted required

## Notes

- All tests must pass in Vitest before removing Jest versions
- Use `.vitest.test.ts` extension for migrated tests
- vitest.config.ts only includes migrated tests
- Original Jest tests continue to work until migration complete