# Vitest Mocking Patterns

## The Fundamental Difference

### Jest vs Vitest Philosophy

**Jest (CommonJS)**
- Automatic transitive dependency mocking
- Complete module replacement
- "Magic" that hides complexity

**Vitest (ESM)**
- Explicit dependency declaration required
- Each layer must be mocked individually
- Forces architectural clarity

### Why This Matters

From Vitest documentation:
> "Needing to mock transitive dependencies is usually a sign of bad code. Consider refactoring using dependency injection."

This is **intentional** - Vitest pushes for better architecture.

## Core Mocking Patterns

### Basic Module Mocking

```typescript
import { vi } from 'vitest';

// Mock a module
vi.mock('~/server/db');

// Mock with implementation
vi.mock('~/lib/logger', () => ({
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));
```

### Transitive Dependencies

When mocking a service, you must also mock its dependencies:

```typescript
// ❌ Jest - This was enough
jest.mock('../service');

// ✅ Vitest - Must be explicit
vi.mock('../service');
vi.mock('../service/logger');
vi.mock('../service/database');
vi.mock('../service/cache');
```

### Variable Hoisting with vi.hoisted()

For shared state between mocks and tests:

```typescript
const { mockUser, mockEnv } = vi.hoisted(() => {
  const mockUser = { id: '1', name: 'Test User' };
  const mockEnv = { NODE_ENV: 'test', API_KEY: 'test-key' };
  
  return { mockUser, mockEnv };
});

vi.mock('~/env.js', () => ({ env: mockEnv }));
vi.mock('~/lib/user', () => ({ 
  getUser: () => mockUser 
}));
```

## Advanced Patterns

### Mock Factories

```typescript
// Create reusable mock factories
export function createMockUserService() {
  return {
    get: vi.fn<[string], Promise<User>>(),
    create: vi.fn<[CreateUserDto], Promise<User>>(),
    update: vi.fn<[string, UpdateUserDto], Promise<User>>(),
    delete: vi.fn<[string], Promise<void>>(),
  };
}

// Usage
const mockUserService = createMockUserService();
mockUserService.get.mockResolvedValue(testUser);
```

### Partial Mocking

```typescript
// Import actual implementation
vi.mock('~/utils', async () => {
  const actual = await vi.importActual<typeof import('~/utils')>('~/utils');
  return {
    ...actual,
    // Override specific function
    calculateHash: vi.fn(() => 'mock-hash'),
  };
});
```

### Dynamic Mocking

```typescript
// Mock that changes behavior during test
const mockFetch = vi.fn();
global.fetch = mockFetch;

// First call fails
mockFetch.mockRejectedValueOnce(new Error('Network error'));

// Second call succeeds
mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({ data: 'success' }),
});
```

## Common Patterns by Type

### Service Mocking

```typescript
// services/__mocks__/userService.ts
export const UserService = vi.fn().mockImplementation(() => ({
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

// In test
vi.mock('~/services/userService');
```

### HTTP/Fetch Mocking

```typescript
const mockFetch = vi.fn<typeof fetch>();
global.fetch = mockFetch;

// Complete Response object for compatibility
const createMockResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: 'OK',
  headers: new Headers(),
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
  clone: function() { return this; },
} as Response);

mockFetch.mockResolvedValue(createMockResponse({ users: [] }));
```

### Event Handler Mocking

```typescript
// Mock event object
const mockEvent = {
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  target: { value: 'test input' },
} as unknown as React.ChangeEvent<HTMLInputElement>;
```

## Anti-Patterns to Avoid

### ❌ Over-Mocking

```typescript
// Bad: Mocking everything
vi.mock('react'); // Don't mock framework
vi.mock('~/types'); // Don't mock types
```

### ❌ Mock Implementation in Mock Declaration

```typescript
// Bad: Complex logic in mock declaration
vi.mock('~/service', () => ({
  getData: () => {
    if (someCondition) { // someCondition not in scope!
      return mockData1;
    }
    return mockData2;
  }
}));

// Good: Use variables from vi.hoisted()
const { mockData } = vi.hoisted(() => ({ 
  mockData: { id: 1 } 
}));

vi.mock('~/service', () => ({
  getData: () => mockData
}));
```

### ❌ Inconsistent Mock Cleanup

```typescript
// Bad: Forgetting to clear mocks
it('test 1', () => {
  mockFn.mockReturnValue(1);
  // No cleanup
});

it('test 2', () => {
  // Surprise! mockFn still returns 1
});

// Good: Always clear in beforeEach
beforeEach(() => {
  vi.clearAllMocks();
});
```

## Mock Utilities

### Type-Safe Mock Creation

```typescript
// Helper for creating typed mocks
function createMock<T>(partial: Partial<T> = {}): T {
  return partial as T;
}

// Usage
const mockUser = createMock<User>({
  id: '1',
  name: 'Test User',
});
```

### Mock Assertion Helpers

```typescript
// Custom matchers for common patterns
expect.extend({
  toHaveBeenCalledWithPartial(received, expected) {
    const calls = received.mock.calls;
    const pass = calls.some(call => 
      Object.entries(expected).every(([key, value]) => 
        call[0]?.[key] === value
      )
    );
    
    return { pass, message: () => 'Expected partial match' };
  }
});
```

## Migration Tips

### When to Mock vs Refactor

**Just Mock When:**
- < 3 dependencies
- Pure utility functions
- Time-sensitive migration
- External APIs

**Refactor to DI When:**
- 5+ transitive dependencies
- Circular dependencies
- Core business logic
- Frequent test changes

### Progressive Enhancement

1. Start with minimal mocks
2. Add transitive mocks as errors appear
3. Consider refactoring if mocks become complex
4. Document patterns for team

Remember: Explicit mocking isn't a limitation - it's a feature that drives better design!