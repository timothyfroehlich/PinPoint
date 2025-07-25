# Prisma Testing Patterns

## The AcceleratePromise Challenge

PinPoint uses Prisma with the Accelerate extension, which changes method return types from `Promise<T>` to `AcceleratePromise<T>`.

### The Problem

```typescript
// Standard Prisma
const user: Promise<User | null> = prisma.user.findUnique({ where: { id } });

// With Accelerate
const user: AcceleratePromise<User | null> = prisma.user.findUnique({ where: { id } });
```

This breaks standard mocking patterns:

```typescript
// ❌ This fails with Accelerate
mockPrisma.user.findUnique.mockResolvedValue(userData);
// Error: Type 'User' is not assignable to type 'AcceleratePromise<User | null>'
```

## Working Solutions

### Solution 1: Use mockImplementation

```typescript
// ✅ Most reliable approach
mockPrisma.user.findUnique.mockImplementation(async () => userData);
mockPrisma.user.findMany.mockImplementation(async () => [userData]);
```

### Solution 2: Type Assertion

```typescript
// ✅ Quick fix for simple cases
mockPrisma.user.findUnique.mockResolvedValue(
  Promise.resolve(userData) as any
);
```

### Solution 3: AcceleratePromise Factory

```typescript
// ✅ Type-safe but verbose
function createAcceleratePromise<T>(value: T): AcceleratePromise<T> {
  const promise = Promise.resolve(value);
  return Object.assign(promise, {
    withAccelerateInfo: promise,
    [Symbol.toStringTag]: "Promise",
  }) as AcceleratePromise<T>;
}

// Usage
mockPrisma.user.findUnique.mockResolvedValue(
  createAcceleratePromise(userData)
);
```

## Complete Mock Structure

### Basic ExtendedPrismaClient Mock

```typescript
import type { ExtendedPrismaClient } from '~/server/db';

const mockPrisma = {
  // User model
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  
  // Organization model
  organization: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  
  // Required: $accelerate methods
  $accelerate: {
    invalidate: vi.fn(),
    invalidateAll: vi.fn(),
  },
  
  // Transaction support
  $transaction: vi.fn(),
  
  // Cleanup
  $disconnect: vi.fn(),
} satisfies Partial<ExtendedPrismaClient>;
```

### Mock Factory Pattern

```typescript
export function createMockPrismaClient(): Partial<ExtendedPrismaClient> {
  return {
    user: createModelMock(),
    organization: createModelMock(),
    gameInstance: createModelMock(),
    issue: createModelMock(),
    member: createModelMock(),
    $accelerate: {
      invalidate: vi.fn().mockResolvedValue(undefined),
      invalidateAll: vi.fn().mockResolvedValue(undefined),
    },
    $transaction: vi.fn().mockImplementation(async (fn) => fn()),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

function createModelMock() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  };
}
```

## Common Testing Scenarios

### Testing Multi-Tenant Queries

```typescript
it('should scope queries by organization', async () => {
  const mockGames = [createMockGameInstance({ organizationId: 'org-1' })];
  mockPrisma.gameInstance.findMany.mockImplementation(async () => mockGames);
  
  const result = await service.getGames('org-1');
  
  expect(mockPrisma.gameInstance.findMany).toHaveBeenCalledWith({
    where: { organizationId: 'org-1' },
    include: expect.any(Object),
  });
});
```

### Testing Transactions

```typescript
it('should handle transaction rollback', async () => {
  const error = new Error('Transaction failed');
  
  mockPrisma.$transaction.mockRejectedValueOnce(error);
  
  await expect(service.complexOperation()).rejects.toThrow(error);
  expect(mockPrisma.$transaction).toHaveBeenCalled();
});
```

### Testing Cache Invalidation

```typescript
it('should invalidate cache after update', async () => {
  mockPrisma.user.update.mockImplementation(async () => updatedUser);
  
  await service.updateUser('user-1', { name: 'New Name' });
  
  expect(mockPrisma.$accelerate.invalidate).toHaveBeenCalledWith(
    expect.stringContaining('user-1')
  );
});
```

## Mock Data Factories

### User Factory

```typescript
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'mock-user-id',
    email: 'test@example.com',
    name: 'Test User',
    image: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}
```

### Organization Factory

```typescript
export function createMockOrganization(
  overrides: Partial<Organization> = {}
): Organization {
  return {
    id: 'mock-org-id',
    name: 'Test Organization',
    subdomain: 'test-org',
    settings: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}
```

### Relationship Factories

```typescript
export function createMockMembership(
  overrides: Partial<Membership> = {}
): Membership {
  return {
    id: 'mock-membership-id',
    userId: 'mock-user-id',
    organizationId: 'mock-org-id',
    role: 'Member',
    permissions: ['issue:view', 'issue:create'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}
```

## Integration Testing Patterns

### Using Real Prisma Client (Test Database)

```typescript
// For integration tests only
import { prisma } from '~/server/db';

beforeEach(async () => {
  // Clean database
  await prisma.$transaction([
    prisma.issue.deleteMany(),
    prisma.gameInstance.deleteMany(),
    prisma.user.deleteMany(),
    prisma.organization.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### Seeding Test Data

```typescript
async function seedTestData() {
  const org = await prisma.organization.create({
    data: {
      name: 'Test Org',
      subdomain: 'test',
    },
  });
  
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User',
    },
  });
  
  await prisma.member.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      role: 'Admin',
    },
  });
  
  return { org, user };
}
```

## Best Practices

1. **Always mock $accelerate** - Even if not used in test
2. **Use mockImplementation** - Most reliable for Accelerate
3. **Create complete mocks** - Include all methods your code might call
4. **Test organization scoping** - Critical for multi-tenancy
5. **Mock at service boundary** - Not at Prisma level for integration tests

## Common Gotchas

### Missing $accelerate Mock
```typescript
// ❌ Incomplete mock
const mockPrisma = {
  user: { findUnique: vi.fn() }
};

// ✅ Complete mock
const mockPrisma = {
  user: { findUnique: vi.fn() },
  $accelerate: {
    invalidate: vi.fn(),
    invalidateAll: vi.fn(),
  }
};
```

### Wrong Mock Return Type
```typescript
// ❌ Returns wrong type
mockPrisma.user.findMany.mockResolvedValue(singleUser);

// ✅ Returns array
mockPrisma.user.findMany.mockResolvedValue([singleUser]);
```

### Forgetting Relations
```typescript
// ❌ Missing included relations
mockPrisma.issue.findUnique.mockResolvedValue(issue);

// ✅ Include relations if query includes them
mockPrisma.issue.findUnique.mockResolvedValue({
  ...issue,
  gameInstance: mockGameInstance,
  creator: mockUser,
});
```