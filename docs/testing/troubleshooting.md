# Vitest Troubleshooting Guide

## Common Issues and Solutions

### Module Resolution Errors

#### Problem: Cannot find module '~/...'
```
Error: Cannot find module '~/server/db'
```

**Solution**: Ensure path aliases are configured in each project:
```typescript
// vitest.config.ts
projects: [
  {
    plugins: [react(), tsconfigPaths()],
    resolve: {
      alias: { '~': path.resolve(__dirname, './src') }
    },
    // ... rest of config
  }
]
```

#### Problem: Module not mocked
```
TypeError: Cannot read property 'findUnique' of undefined
```

**Solution**: Mock all transitive dependencies:
```typescript
vi.mock('~/server/db');
vi.mock('~/server/db/client'); // Also mock this!
vi.mock('~/lib/prisma');       // And this!
```

### TypeScript Errors

#### Problem: AcceleratePromise type errors
```
Type 'User' is not assignable to type 'AcceleratePromise<User | null>'
```

**Solution**: Use mockImplementation:
```typescript
// ❌ Fails
mockPrisma.user.findUnique.mockResolvedValue(userData);

// ✅ Works
mockPrisma.user.findUnique.mockImplementation(async () => userData);
```

#### Problem: vi.hoisted() type errors
```
Cannot access 'mockData' before initialization
```

**Solution**: Use vi.hoisted() for shared variables:
```typescript
const { mockData } = vi.hoisted(() => ({
  mockData: { id: 1, name: 'Test' }
}));

vi.mock('~/service', () => ({
  getData: () => mockData
}));
```

### Environment Issues

#### Problem: window is not defined
```
ReferenceError: window is not defined
```

**Solution**: Ensure test is in jsdom project:
```typescript
// File should match jsdom include pattern:
// src/app/**/*.vitest.test.ts
// src/components/**/*.vitest.test.ts
// src/hooks/**/*.vitest.test.ts
```

#### Problem: document is not defined
```
ReferenceError: document is not defined
```

**Solution**: Check environment configuration:
```typescript
// Should be in jsdom project, not node project
test: {
  name: 'jsdom',
  environment: 'jsdom',
  // ...
}
```

### Mock-Related Issues

#### Problem: Mock not clearing between tests
```
Expected: 1
Received: 3 // Accumulated from previous tests
```

**Solution**: Always clear mocks:
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

#### Problem: Mock function not callable
```
TypeError: mockFn is not a function
```

**Solution**: Ensure proper mock structure:
```typescript
// ❌ Wrong
const mockService = { getData: 'not-a-function' };

// ✅ Right
const mockService = { getData: vi.fn() };
```

### Async/Promise Issues

#### Problem: Test timeout
```
Error: Test timed out in 5000ms
```

**Solution**: Ensure promises are handled:
```typescript
// ❌ Missing await
it('should work', () => {
  service.asyncMethod(); // No await!
});

// ✅ Proper async handling
it('should work', async () => {
  await service.asyncMethod();
});
```

#### Problem: Unhandled promise rejection
```
UnhandledPromiseRejectionWarning
```

**Solution**: Always handle rejections:
```typescript
// In test
await expect(service.method()).rejects.toThrow();

// In mock
mockFn.mockRejectedValue(new Error('Expected error'));
```

### Import/Export Issues

#### Problem: Cannot use import statement outside a module
```
SyntaxError: Cannot use import statement outside a module
```

**Solution**: Ensure proper ESM configuration:
1. Check `package.json` has `"type": "module"`
2. Use `.js` extensions in imports if needed
3. Configure transformers properly

#### Problem: Circular dependency
```
Error: Circular dependency detected
```

**Solution**: Refactor to remove circular deps:
```typescript
// ❌ service.ts imports helper.ts
// ❌ helper.ts imports service.ts

// ✅ Extract shared code to third file
// ✅ Use dependency injection
```

## Infrastructure Issues

### The Cascade Effect

**Problem**: Fixing one file breaks many others

**Example**: Changing mockContext.ts broke 40+ tests

**Solution Strategy**:
1. Map dependencies first: `grep -r "mockContext" src/`
2. Make incremental changes
3. Keep interfaces stable
4. Track total error count

### Parallel Test Failures

**Problem**: Tests pass individually but fail when run together

**Solution**: Check for test pollution:
```typescript
// Ensure complete cleanup
afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

// Reset global state
beforeEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
});
```

## Performance Issues

### Slow Test Execution

**Problem**: Tests running slower than expected

**Diagnosis**:
```bash
# Run with timing info
npm run test:vitest -- --reporter=verbose

# Profile specific test
time npm run test:vitest -- path/to/slow.test.ts
```

**Solutions**:
1. Mock I/O operations
2. Use test factories instead of real data
3. Minimize setup/teardown
4. Check for unnecessary delays/timeouts

### Memory Leaks

**Problem**: Memory usage growing during test runs

**Solution**: Clean up properly:
```typescript
afterEach(() => {
  // Clear all mocks
  vi.clearAllMocks();
  
  // Clear timers
  vi.clearAllTimers();
  
  // Clear module cache if needed
  vi.resetModules();
});

afterAll(() => {
  // Disconnect services
  await prisma.$disconnect();
  await server.close();
});
```

## Migration-Specific Issues

### Jest Compatibility

**Problem**: Jest patterns not working in Vitest

**Common differences**:
```typescript
// Jest
jest.requireActual('../module');
jest.useFakeTimers();

// Vitest
vi.importActual('../module');
vi.useFakeTimers();
```

### MSW Integration

**Problem**: MSW handlers not intercepting

**Solution**: Ensure proper setup:
```typescript
// Setup file
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Debugging Techniques

### 1. Isolate the Problem
```bash
# Run single test
npm run test:vitest -- -t "specific test name"

# Run single file
npm run test:vitest -- path/to/test.ts
```

### 2. Add Debug Output
```typescript
// Temporary debug logs
console.log('Mock calls:', mockFn.mock.calls);
console.log('Mock state:', { ...mockObject });
```

### 3. Check Mock Calls
```typescript
// See what was actually called
expect(mockFn).toHaveBeenCalled();
console.log('Called with:', mockFn.mock.calls);
```

### 4. Verify Module Mocks
```typescript
// Check if module is mocked
vi.mocked(moduleToCheck);
```

## Getting Help

### Error Messages
1. Read the full error message
2. Check the stack trace
3. Look for the root cause

### Resources
- [Vitest Documentation](https://vitest.dev)
- [GitHub Issues](https://github.com/vitest-dev/vitest/issues)
- Team knowledge base
- This troubleshooting guide

### When to Refactor
If you spend > 30 minutes debugging mocks, consider:
1. Refactoring to dependency injection
2. Simplifying the component/service
3. Breaking into smaller, testable units