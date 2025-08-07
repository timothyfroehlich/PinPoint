# Test Utilities Reference

**Purpose**: Central reference for all PinPoint test utilities and helpers  
**Status**: Active - Phase 2A Drizzle Foundation with Infrastructure Testing Utilities  
**Scope**: Unit testing utilities, integration testing utilities, infrastructure testing utilities, quick reference patterns

---

## 🚀 Quick Reference

### Essential Imports

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom";

import {
  VitestTestWrapper,
  VITEST_PERMISSION_SCENARIOS,
} from "~/test/VitestTestWrapper";

// Infrastructure Testing Utilities
import {
  cleanupTestData,
  createTestOrganization,
  createTestUserWithMembership,
  createTestMachine,
  createTestIssue,
} from "~/test/database-test-helpers";

import {
  configureDevelopmentMocks,
  createLocalhost5432URL,
  expectSSLConfiguration,
  importDrizzleModule,
} from "~/server/db/__tests__/drizzle-test-helpers";

import {
  createCleanEnvironment,
  setTestEnvironmentVars,
  setupDevelopmentScenario,
  configureDotenvMocks,
} from "~/lib/env-loaders/__tests__/env-test-helpers";
```

### Quick Test Template

#### Component Testing Template

```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle unauthenticated users', () => {
    render(
      <VitestTestWrapper supabaseUser={null}>
        <ComponentName />
      </VitestTestWrapper>
    );

    expect(screen.getByTestId('public-content')).toBeInTheDocument();
  });

  it('should handle authenticated users with permissions', () => {
    render(
      <VitestTestWrapper userPermissions={['required:permission']}>
        <ComponentName />
      </VitestTestWrapper>
    );

    expect(screen.getByTestId('authenticated-content')).toBeInTheDocument();
  });
});
```

#### Infrastructure Testing Template

```typescript
import { cleanupTestData, createTestOrganization, type TestDataIds } from "~/test/database-test-helpers";
import { createCleanEnvironment } from "~/lib/env-loaders/__tests__/env-test-helpers";
import { configureDevelopmentMocks } from "~/server/db/__tests__/drizzle-test-helpers";

describe('Infrastructure Test', () => {
  let testIds: TestDataIds = {};
  let restoreEnv: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    configureDevelopmentMocks();
    restoreEnv = createCleanEnvironment();
  });

  afterEach(async () => {
    await cleanupTestData(db, testIds);
    testIds = {};
    restoreEnv();
  });

  it('should handle database operations with proper cleanup', async () => {
    const org = await createTestOrganization(db, { name: "Test Org" });
    testIds.orgIds = [org.id];

    // Test your database operations...
    // Cleanup happens automatically in afterEach
  });
});
```

### Common Patterns

```typescript
// Unauthenticated test
<VitestTestWrapper supabaseUser={null}>

// Admin user
<VitestTestWrapper userPermissions={VITEST_PERMISSION_SCENARIOS.ADMIN}>

// Loading state
<VitestTestWrapper sessionLoading={true}>

// Custom permissions
<VitestTestWrapper userPermissions={['issue:view', 'issue:create']}>
```

---

## 🧪 Unit Testing Utilities

### VitestTestWrapper - Primary Component Test Wrapper

**Location**: `src/test/VitestTestWrapper.tsx`

**Purpose**: Centralized test wrapper providing auth context, permissions, and tRPC providers with configurable mock states.

#### Basic Usage

```typescript
import { VitestTestWrapper } from '~/test/VitestTestWrapper';

// Default authenticated user
render(
  <VitestTestWrapper>
    <ComponentUnderTest />
  </VitestTestWrapper>
);
```

#### Configuration Options

```typescript
interface VitestTestWrapperProps {
  children: ReactNode;

  // Authentication
  session?: { user: User; expires: string } | null;
  supabaseUser?: PinPointSupabaseUser | null;
  sessionLoading?: boolean;

  // Permissions
  userPermissions?: string[];
  userRole?: string;
  membershipLoading?: boolean;

  // Query States
  queryOptions?: {
    isLoading?: boolean;
    isError?: boolean;
    error?: Error | null;
  };
}
```

#### Authentication State Testing

```typescript
// Unauthenticated user
render(
  <VitestTestWrapper supabaseUser={null}>
    <PublicComponent />
  </VitestTestWrapper>
);

// Loading state
render(
  <VitestTestWrapper sessionLoading={true}>
    <LoadingAwareComponent />
  </VitestTestWrapper>
);

// Error state
render(
  <VitestTestWrapper
    queryOptions={{
      isError: true,
      error: new Error('Auth failed')
    }}
  >
    <ErrorHandlingComponent />
  </VitestTestWrapper>
);
```

### Permission Scenarios

**Pre-configured permission sets** for common test cases:

```typescript
import { VITEST_PERMISSION_SCENARIOS, VITEST_ROLE_MAPPING } from '~/test/VitestTestWrapper';

// Available scenarios
VITEST_PERMISSION_SCENARIOS.ADMIN     // Full system permissions
VITEST_PERMISSION_SCENARIOS.MANAGER   // Management permissions
VITEST_PERMISSION_SCENARIOS.MEMBER    // Basic member permissions
VITEST_PERMISSION_SCENARIOS.PUBLIC    // No permissions

// Usage
render(
  <VitestTestWrapper
    userPermissions={VITEST_PERMISSION_SCENARIOS.ADMIN}
    userRole={VITEST_ROLE_MAPPING.ADMIN}
  >
    <AdminPanel />
  </VitestTestWrapper>
);
```

#### Permission Details

```typescript
// ADMIN permissions include:
[
  "issue:view",
  "issue:create",
  "issue:update",
  "issue:edit",
  "issue:delete",
  "issue:assign",
  "machine:view",
  "machine:create",
  "machine:update",
  "machine:delete",
  "location:view",
  "location:create",
  "location:update",
  "location:delete",
  "organization:admin",
  "organization:manage",
  "role:manage",
  "user:manage",
  "attachment:create",
  "attachment:delete",
][
  // MANAGER permissions include:
  ("issue:view",
  "issue:create",
  "issue:update",
  "machine:view",
  "machine:create",
  "machine:update",
  "location:view")
][
  // MEMBER permissions include:
  ("issue:view", "issue:create", "machine:view")
];
```

### Mock Data Factories

#### Supabase User Factory

```typescript
import { createMockSupabaseUser } from "~/test/VitestTestWrapper";

// Complete Supabase user with overrides
const mockUser = createMockSupabaseUser({
  id: "custom-id",
  email: "custom@example.com",
  organizationId: "my-org",
  role: "admin",
  name: "Custom Admin",
});
```

#### User and Membership Factories

```typescript
import { createMockUser, createMockMembership } from "~/test/VitestTestWrapper";

// Prisma User factory
const mockUser = createMockUser({
  name: "Custom User",
  email: "custom@example.com",
});

// Membership factory
const mockMembership = createMockMembership({
  userId: "user-123",
  organizationId: "org-456",
  role: "Manager",
  permissions: ["issue:view", "issue:create"],
});
```

### Permission Testing Patterns

#### Test Both Authorized and Unauthorized States

```typescript
describe('Permission-based Features', () => {
  const permissionTests = [
    { permission: 'issue:edit', button: 'edit-button' },
    { permission: 'issue:delete', button: 'delete-button' },
    { permission: 'issue:assign', button: 'assign-button' }
  ];

  permissionTests.forEach(({ permission, button }) => {
    it(`should enable ${button} when user has ${permission}`, () => {
      render(
        <VitestTestWrapper userPermissions={[permission]}>
          <IssueActions />
        </VitestTestWrapper>
      );

      expect(screen.getByTestId(button)).toBeEnabled();
    });

    it(`should disable ${button} when user lacks ${permission}`, () => {
      render(
        <VitestTestWrapper userPermissions={[]}>
          <IssueActions />
        </VitestTestWrapper>
      );

      const button = screen.getByTestId(`disabled-${button}`);
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', expect.stringContaining('permission'));
    });
  });
});
```

### Hook Testing Utilities

#### Testing Hooks with Context

```typescript
import { renderHook } from '@testing-library/react';
import { usePermissions } from '~/hooks/usePermissions';

// Create reusable wrapper function
const createWrapper = (options = {}) => {
  return ({ children }) => (
    <VitestTestWrapper {...options}>
      {children}
    </VitestTestWrapper>
  );
};

describe('usePermissions Hook', () => {
  it('should return correct permissions for admin user', () => {
    const wrapper = createWrapper({
      userPermissions: VITEST_PERMISSION_SCENARIOS.ADMIN,
      userRole: 'Admin'
    });

    const { result } = renderHook(() => usePermissions(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.hasPermission('organization:admin')).toBe(true);
    expect(result.current.isAdmin).toBe(true);
  });
});
```

---

## 🔧 Integration Testing Utilities

### Database Transaction Helpers

**Purpose**: Utilities for integration tests that require database interactions with proper isolation.

#### Transaction-Based Test Pattern

```typescript
// Example integration test setup (refer to integration-patterns.md for full details)
import { testDb, testSupabaseAdmin } from "~/test/integration-setup";

describe("Database Integration", () => {
  beforeEach(async () => {
    await testDb.transaction.begin();
  });

  afterEach(async () => {
    await testDb.transaction.rollback();
  });

  it("should create issue with proper multi-tenant isolation", async () => {
    // Integration test with real database
  });
});
```

### Multi-Tenant Test Utilities

#### Organization Isolation Testing

```typescript
describe('Multi-tenant Security', () => {
  it('should prevent cross-organization data access', async () => {
    const userInOrgA = createMockSupabaseUser({ organizationId: 'org-a' });

    render(
      <VitestTestWrapper supabaseUser={userInOrgA}>
        <IssueList organizationContext="org-b" />
      </VitestTestWrapper>
    );

    await expect(
      screen.findByText('You do not have permission to view this organization')
    ).resolves.toBeInTheDocument();
  });
});
```

### Service Integration Helpers

#### External Service Mocking

```typescript
// Mock external APIs while testing internal integration
vi.mock("~/lib/api/external-service", () => ({
  ExternalService: {
    send: vi.fn().mockResolvedValue({ success: true }),
    fetch: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

// Test internal service integration without external dependencies
describe("Service Integration", () => {
  it("should handle external service responses correctly", async () => {
    // Test internal logic with mocked external service
  });
});
```

---

## 🏗️ Infrastructure Testing Utilities

**Purpose**: Specialized utilities for testing database operations, mock configurations, and environment management with proper isolation and cleanup.

### Database Test Helpers

**Location**: `src/test/database-test-helpers.ts`

**Purpose**: Centralized utilities for database integration testing with proper multi-tenant isolation and dependency-order cleanup.

#### Database Cleanup Utilities

```typescript
import { cleanupTestData, type TestDataIds } from "~/test/database-test-helpers";

describe("Database Integration Test", () => {
  let testIds: TestDataIds = {};

  afterEach(async () => {
    // Automatically handles dependency order cleanup
    await cleanupTestData(db, testIds);
    testIds = {};
  });

  it("should create and cleanup test data properly", async () => {
    const org = await createTestOrganization(db, { name: "Test Organization" });
    testIds.orgIds = [org.id];
    
    const machine = await createTestMachine(db, org.id, { 
      machineName: "Test Machine" 
    });
    testIds.machineId = machine.machine.id;

    // Test your functionality here...
    // Cleanup happens automatically in afterEach
  });
});
```

#### Test Data Factories

```typescript
// Create complete organizational structure
const { user, membership, role } = await createTestUserWithMembership(
  db, 
  organizationId, 
  'admin', 
  { name: "Admin User", email: "admin@test.com" }
);

// Create machine with related location and model
const { machine, location, model } = await createTestMachine(
  db,
  organizationId,
  { machineName: "Medieval Madness" }
);

// Create issue with priority and status
const { issue, priority, status } = await createTestIssue(
  db,
  machineId,
  organizationId,
  { description: "Flipper needs adjustment" }
);
```

#### Multi-Tenant Testing Environment

```typescript
import { createMultiTenantTestEnvironment } from "~/test/database-test-helpers";

describe("Multi-tenant Isolation", () => {
  it("should prevent cross-organization data access", async () => {
    const { orgA, orgB, userInOrgA, userInOrgB } = 
      await createMultiTenantTestEnvironment(db);

    // Test that userInOrgA cannot access orgB data
    const orgBIssues = await db
      .select()
      .from(issues)
      .where(eq(issues.organizationId, orgB.id));
    
    // Verify isolation...
  });
});
```

### Drizzle Mock Helpers

**Location**: `src/server/db/__tests__/drizzle-test-helpers.ts`

**Purpose**: Standardized mock configuration for Drizzle singleton testing with environment presets and validation utilities.

#### Environment Configuration Presets

```typescript
import { 
  configureDevelopmentMocks,
  configureProductionMocks,
  configureCIMocks 
} from "~/server/db/__tests__/drizzle-test-helpers";

describe("Drizzle Client Configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should configure development environment correctly", () => {
    configureDevelopmentMocks();
    
    // Test development-specific behavior
  });

  it("should configure production environment correctly", () => {
    configureProductionMocks();
    
    // Test production-specific SSL, pooling, etc.
  });
});
```

#### Connection String Builders

```typescript
import { 
  createLocalhost5432URL,
  createRemoteURL,
  create127001URL 
} from "~/server/db/__tests__/drizzle-test-helpers";

// Generate test connection strings
const localUrl = createLocalhost5432URL("test_db");
// Result: "postgresql://localhost:5432/test_db"

const remoteUrl = createRemoteURL("db.example.com", "production_db");
// Result: "postgresql://db.example.com:5432/production_db"

const ipUrl = create127001URL("dev_db");
// Result: "postgresql://127.0.0.1:5432/dev_db"
```

#### Mock Validation Helpers

```typescript
import { 
  expectSSLConfiguration,
  expectPoolConfiguration,
  expectTimeoutConfiguration 
} from "~/server/db/__tests__/drizzle-test-helpers";

it("should configure SSL properly in production", () => {
  configureProductionMocks();
  
  expectSSLConfiguration(true);
  expectPoolConfiguration(20);
  expectTimeoutConfiguration(30000, 5000);
});
```

### Environment Test Helpers

**Location**: `src/lib/env-loaders/__tests__/env-test-helpers.ts`

**Purpose**: Environment variable management for loader testing with automatic cleanup and scenario presets.

#### Clean Environment Management

```typescript
import { createCleanEnvironment } from "~/lib/env-loaders/__tests__/env-test-helpers";

describe("Environment Loader", () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    // Creates clean environment, returns restore function
    restoreEnv = createCleanEnvironment(['DATABASE_URL', 'CUSTOM_VAR']);
  });

  afterEach(() => {
    restoreEnv(); // Automatically restores original environment
  });

  it("should load environment variables correctly", () => {
    // Test with clean environment
  });
});
```

#### File Content Simulation

```typescript
import { simulateEnvFileContents } from "~/lib/env-loaders/__tests__/env-test-helpers";

it("should respect file precedence order", () => {
  simulateEnvFileContents({
    '.env': { DATABASE_URL: 'base-url', COMMON_VAR: 'base' },
    '.env.development': { DATABASE_URL: 'dev-url' },
    '.env.local': { COMMON_VAR: 'local-override' }
  });

  // Test that dev-url and local-override take precedence
});
```

#### Environment Scenario Presets

```typescript
import { 
  setupDevelopmentScenario,
  setupProductionScenario,
  setupCIScenario 
} from "~/lib/env-loaders/__tests__/env-test-helpers";

describe("Environment-specific Behavior", () => {
  it("should handle development environment", () => {
    setupDevelopmentScenario();
    // Automatically sets NODE_ENV=development, local URLs, etc.
  });

  it("should handle CI environment", () => {
    setupCIScenario();
    // Sets CI=true, test database URLs, etc.
  });
});
```

#### Load Order Validation

```typescript
import { 
  configureDotenvMocks,
  expectFileLoadOrder 
} from "~/lib/env-loaders/__tests__/env-test-helpers";

it("should load files in correct order", async () => {
  const { mockDotenvConfig } = configureDotenvMocks();
  
  await import("../development");
  
  expectFileLoadOrder([
    '.env',
    '.env.development', 
    '.env.local'
  ], mockDotenvConfig);
});
```

---

## 🛠️ Debugging Utilities

### Common Debug Patterns

#### DOM Inspection

```typescript
import { screen } from '@testing-library/react';

// Debug current DOM structure
render(<Component />);
screen.debug(); // Shows entire DOM
screen.debug(screen.getByTestId('specific-element')); // Shows specific element
```

#### Mock Verification

```typescript
// Verify mock calls
expect(mockFunction).toHaveBeenCalledWith(expectedArgs);
expect(mockFunction).toHaveBeenCalledTimes(1);

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
```

#### Async State Debugging

```typescript
// Wait for async updates
await waitFor(() => {
  expect(screen.getByText("Updated content")).toBeInTheDocument();
});

// Wait for element to disappear
await waitFor(() => {
  expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
});
```

### Common Test Issues and Solutions

#### 1. "Must be wrapped in provider" Errors

```typescript
// ❌ PROBLEM: Component uses auth/permission hooks without provider
render(<ComponentWithHooks />);

// ✅ SOLUTION: Always use VitestTestWrapper
render(
  <VitestTestWrapper>
    <ComponentWithHooks />
  </VitestTestWrapper>
);
```

#### 2. Permission Tests Failing

```typescript
// ❌ PROBLEM: Permission not properly injected
render(
  <VitestTestWrapper>
    <PermissionComponent />
  </VitestTestWrapper>
);

// ✅ SOLUTION: Explicitly provide permissions
render(
  <VitestTestWrapper userPermissions={['required:permission']}>
    <PermissionComponent />
  </VitestTestWrapper>
);
```

#### 3. Incomplete Mock Data Errors

```typescript
// ❌ PROBLEM: Partial mock data missing required fields
const mockUser = { id: "1", email: "test@example.com" }; // Missing organizationId, etc.

// ✅ SOLUTION: Use factory functions
const mockUser = createMockSupabaseUser({ email: "test@example.com" }); // Complete data structure
```

---

## 📋 Testing Checklists

### Component Test Checklist

- [ ] Uses VitestTestWrapper for auth/permission context
- [ ] Tests unauthenticated state
- [ ] Tests authenticated state with appropriate permissions
- [ ] Tests loading states (session loading, permission loading)
- [ ] Tests error states (auth errors, permission errors)
- [ ] Uses complete mock data from factory functions
- [ ] Tests user interactions with userEvent
- [ ] Waits for async operations with waitFor

### Permission Test Checklist

- [ ] Tests both authorized and unauthorized states
- [ ] Verifies disabled buttons have appropriate tooltips
- [ ] Tests multi-tenant isolation where applicable
- [ ] Uses VITEST_PERMISSION_SCENARIOS for common cases
- [ ] Covers edge cases (empty permissions, loading permissions)

### Integration Test Checklist

- [ ] Uses transaction-based isolation for database tests
- [ ] Mocks only external services, not internal components
- [ ] Tests complete user workflows end-to-end
- [ ] Verifies multi-tenant security boundaries
- [ ] Tests error handling and recovery scenarios

### Infrastructure Test Checklist

- [ ] Uses database test helpers for proper cleanup (`cleanupTestData`)
- [ ] Employs test data factories instead of manual data creation
- [ ] Uses environment helpers for clean test isolation
- [ ] Leverages Drizzle mock helpers for singleton testing
- [ ] Includes multi-tenant isolation testing where applicable
- [ ] Uses scenario presets for environment-specific testing
- [ ] Validates database dependency order in cleanup
- [ ] Tests both mock and real database scenarios appropriately

---

**Quick Navigation:**

- For general testing patterns: [vitest-guide.md](./vitest-guide.md)
- For pure function testing: [unit-patterns.md](./unit-patterns.md)
- For database testing: [integration-patterns.md](./integration-patterns.md)
- For troubleshooting: [troubleshooting.md](./troubleshooting.md)
