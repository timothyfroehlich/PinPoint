# TASK-010: Create Vitest Test Helpers

**Priority**: MEDIUM  
**Type**: Test Infrastructure  
**Estimated Time**: 25-30 minutes  
**Status**: Not Started

## Objective

Create reusable test helpers and utilities specific to Vitest to make test migration and writing easier.

## Prerequisites

- TASK-006 completed (MSW-tRPC setup)
- TASK-009 completed (environment configuration)

## Helpers to Create

### 1. Mock Context Helper

Create `src/test/vitest.mockContext.ts`:
```typescript
import { vi } from 'vitest';
import type { ExtendedPrismaClient } from '~/server/db';
import type { Session } from 'next-auth';

export interface MockContext {
  db: ExtendedPrismaClient;
  session: Session | null;
  organizationId: string | null;
}

export function createMockContext(): MockContext {
  const mockDb = {
    // Base Prisma methods
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    
    // Accelerate extension
    $accelerate: {
      invalidate: vi.fn(),
      invalidateAll: vi.fn(),
      ttl: vi.fn(),
    },
    
    // Model mocks
    user: createModelMock(),
    organization: createModelMock(),
    membership: createModelMock(),
    role: createModelMock(),
    permission: createModelMock(),
    machine: createModelMock(),
    model: createModelMock(),
    location: createModelMock(),
    issue: createModelMock(),
    comment: createModelMock(),
    // Add other models as needed
  } as unknown as ExtendedPrismaClient;

  return {
    db: mockDb,
    session: null,
    organizationId: null,
  };
}

function createModelMock() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  };
}

export function resetMockContext(ctx: MockContext) {
  // Reset all mocks
  Object.values(ctx.db).forEach(value => {
    if (typeof value === 'object' && value !== null) {
      Object.values(value).forEach(fn => {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          fn.mockReset();
        }
      });
    }
  });
}
```

### 2. Test Data Factories

Create `src/test/vitest.factories.ts`:
```typescript
import { faker } from '@faker-js/faker';
import type { User, Organization, Issue, Machine } from '@prisma/client';

export const factories = {
  user: (overrides: Partial<User> = {}): User => ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    emailVerified: null,
    image: faker.image.avatar(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  organization: (overrides: Partial<Organization> = {}): Organization => ({
    id: faker.string.uuid(),
    name: faker.company.name(),
    subdomain: faker.lorem.slug(),
    logoUrl: faker.image.url(),
    primaryColor: faker.color.rgb(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  issue: (overrides: Partial<Issue> = {}): Issue => ({
    id: faker.string.uuid(),
    title: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    statusId: 'status-open',
    priorityId: 'priority-medium',
    organizationId: 'org-1',
    machineId: 'machine-1',
    createdById: 'user-1',
    assignedToId: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  machine: (overrides: Partial<Machine> = {}): Machine => ({
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    serialNumber: faker.string.alphanumeric(10),
    modelId: 'model-1',
    locationId: 'location-1',
    qrCodeId: faker.string.alphanumeric(8),
    notes: null,
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};
```

### 3. React Testing Utilities

Create `src/test/vitest.react.tsx`:
```typescript
import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';

interface TestWrapperProps {
  children: React.ReactNode;
  session?: Session | null;
}

export function TestWrapper({ children, session = null }: TestWrapperProps) {
  return (
    <SessionProvider session={session}>
      {children}
    </SessionProvider>
  );
}

export function renderWithSession(
  ui: React.ReactElement,
  session?: Session | null,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <TestWrapper session={session}>{children}</TestWrapper>
    ),
    ...options,
  });
}

// Create mock session
export function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    user: {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}
```

### 4. Async Test Utilities

Create `src/test/vitest.async.ts`:
```typescript
import { waitFor } from '@testing-library/react';

export async function waitForAsync(fn: () => void | Promise<void>, options = {}) {
  await waitFor(fn, {
    timeout: 5000,
    ...options,
  });
}

export function flushPromises() {
  return new Promise(resolve => setImmediate(resolve));
}

export async function expectAsync(promise: Promise<any>) {
  let result;
  let error;
  
  try {
    result = await promise;
  } catch (e) {
    error = e;
  }
  
  return {
    toResolve: () => {
      if (error) throw error;
      return result;
    },
    toReject: () => {
      if (!error) throw new Error('Expected promise to reject');
      return error;
    },
    toRejectWith: (expectedError: any) => {
      if (!error) throw new Error('Expected promise to reject');
      expect(error).toEqual(expectedError);
    },
  };
}
```

### 5. MSW Test Utilities

Create `src/test/vitest.msw.ts`:
```typescript
import { server } from './msw/setup';
import { handlers } from './msw/handlers';

export function mockAuthenticatedUser(userId = 'user-1', orgId = 'org-1') {
  server.use(
    handlers.userGetProfile({ id: userId }),
    handlers.organizationGetCurrent({ id: orgId })
  );
}

export function mockUnauthenticatedUser() {
  server.use(
    handlers.errorUnauthorized('user.getProfile'),
    handlers.errorUnauthorized('organization.getCurrent')
  );
}

export function mockUserWithPermissions(permissions: string[]) {
  server.use(
    handlers.userGetProfile({
      id: 'user-1',
      permissions, // Assuming this is added to user type
    })
  );
}
```

### 6. Main Helper Export

Update `src/test/vitest.helpers.ts`:
```typescript
// Re-export all helpers
export * from './vitest.mockContext';
export * from './vitest.factories';
export * from './vitest.react';
export * from './vitest.async';
export * from './vitest.msw';

// Environment helpers
export function getTestEnvironment(): 'node' | 'jsdom' {
  return typeof window !== 'undefined' ? 'jsdom' : 'node';
}

export function isNodeEnvironment(): boolean {
  return getTestEnvironment() === 'node';
}

export function isJsdomEnvironment(): boolean {
  return getTestEnvironment() === 'jsdom';
}
```

## Usage Examples

### Server Test
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockContext, resetMockContext, factories } from '~/test/vitest.helpers';

describe('UserService', () => {
  const ctx = createMockContext();
  
  beforeEach(() => {
    resetMockContext(ctx);
  });
  
  it('should find user', async () => {
    const mockUser = factories.user({ id: 'test-user' });
    ctx.db.user.findUnique.mockResolvedValue(mockUser);
    
    // Test implementation
  });
});
```

### React Component Test
```typescript
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithSession, createMockSession } from '~/test/vitest.helpers';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render for authenticated user', () => {
    const session = createMockSession({
      user: { id: '1', name: 'Test User' }
    });
    
    renderWithSession(<MyComponent />, session);
    
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });
});
```

## Verification

- [ ] All helper files created
- [ ] TypeScript compilation passes
- [ ] Helpers can be imported in test files
- [ ] Example usage works correctly
- [ ] No conflicts with existing test utilities

## Success Criteria

- Reusable helpers reduce boilerplate in tests
- Type safety maintained throughout
- Easy to use and understand
- Compatible with both Node and jsdom environments
- Speeds up test migration process

## Notes

These helpers will significantly improve the developer experience when writing and migrating tests to Vitest.