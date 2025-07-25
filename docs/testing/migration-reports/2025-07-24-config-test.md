# Migration Report: config.test.ts

**Date**: 2025-07-24  
**Original File**: `src/server/auth/__tests__/config.test.ts`  
**Migrated File**: `src/server/auth/__tests__/config.vitest.test.ts`  

## Summary
- **Test Count**: 11 tests
- **Test Types**: NextAuth configuration, environment variables, provider testing
- **Migration Time**: Already completed (found existing migration)
- **Complexity**: Complex - required vi.hoisted() for environment mocking

## Performance Results
- **Jest**: 537ms
- **Vitest**: 46ms  
- **Improvement**: 11.7x faster

## Changes Made

### 1. Basic Updates
- [x] Updated imports to Vitest
- [x] Replaced Jest globals (jest.fn → vi.fn, jest.resetModules → vi.resetModules)
- [x] Added vi.clearAllMocks() to beforeEach

### 2. Mocking Changes
- Used vi.hoisted() for shared environment variables and mock functions
- Mocked NextAuth providers (Google, Credentials) with complex factory functions
- Mocked @auth/prisma-adapter for proper NextAuth adapter testing
- Created proper mock database context for authentication testing

### 3. Special Patterns
- **vi.hoisted() usage**: Required for shared mock state across module imports
- **Environment variable mocking**: Complex pattern for testing development vs production configs
- **NextAuth provider mocking**: Dynamic provider configuration based on NODE_ENV

## Challenges & Solutions

### Challenge 1: Environment Variable Hoisting
**Problem**: Environment variables needed to be accessible across module imports and dynamic require() calls.
**Solution**: Used vi.hoisted() pattern to create shared mock environment that could be modified by helper functions.

```typescript
const { mockEnv, setNodeEnv, mockUserFindUnique } = vi.hoisted(() => {
  const mockEnv = { 
    NODE_ENV: "development",
    NEXTAUTH_SECRET: "test-secret",
    // ... other env vars
  };
  
  const setNodeEnv = (env: string) => { 
    mockEnv.NODE_ENV = env; 
  };
  
  return { mockEnv, setNodeEnv, mockUserFindUnique };
});
```

### Challenge 2: NextAuth Provider Mocking
**Problem**: NextAuth providers require complex factory function mocking with proper type interfaces.
**Solution**: Created comprehensive mocks for both Google and Credentials providers with proper configuration handling.

## Patterns Discovered
- **vi.hoisted() for shared state**: Essential for environment variable mocking in complex configs
- **Dynamic module re-importing**: Using vi.resetModules() + dynamic import() for testing different environments
- **Provider factory mocking**: Proper NextAuth provider mocking requires factory function patterns
- **Type casting for provider interfaces**: NextAuth Provider type doesn't expose id, requiring helper interfaces

## Lessons Learned
- Environment variable mocking in Vitest requires vi.hoisted() for proper variable sharing
- Complex authentication configuration testing benefits significantly from explicit dependency mocking
- NextAuth provider testing requires understanding the internal factory pattern
- The migration was already completed by previous work, demonstrating the value of systematic approach

## Architecture Insights
- NextAuth configuration is highly environment-dependent, making proper mocking crucial
- The credentials provider pattern shows good separation between development and production configs
- Database adapter mocking establishes patterns for other authentication-related tests