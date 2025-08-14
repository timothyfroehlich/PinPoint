# Issue Router Test Factory Usage Guide

## Overview

Enhanced `testDataFactories.ts` with specialized factories for the issue router test ecosystem to reduce duplication across multiple test files:

- `issue.test.ts` - Core issue router unit tests
- `issue.integration.test.ts` - Complex workflow integration tests with PGlite
- `issue.comment.test.ts` - Comment-specific router tests
- `issue.attachment.ts` - Attachment router tests

## New Factories Available

### 1. `createIssueRouterContext(options)`

Creates authenticated context specifically for issue router testing.

```typescript
import { createIssueRouterContext } from "~/test/testDataFactories";

const context = createIssueRouterContext({
  userId: "user-1",
  organizationId: "org-1",
  permissions: ["issue:view", "issue:edit"],
  role: "Technician",
});
```

### 2. `createIssueTestScenarios`

Common issue scenarios for different test cases.

```typescript
import { createIssueTestScenarios } from "~/test/testDataFactories";

// Available scenarios:
const newIssue = createIssueTestScenarios.newIssue();
const assignedIssue = createIssueTestScenarios.assignedIssue();
const resolvedIssue = createIssueTestScenarios.resolvedIssue();
const issueWithHistory = createIssueTestScenarios.issueWithHistory();
const crossOrgIssue = createIssueTestScenarios.crossOrgIssue(); // for security testing
```

### 3. `createTRPCCallerForIssues(options)`

Helper to create tRPC caller with issue-specific context.

```typescript
import { createTRPCCallerForIssues } from "~/test/testDataFactories";

const { context, createCaller } = createTRPCCallerForIssues({
  permissions: ["issue:view", "issue:edit"],
  role: "Technician",
});

const caller = createCaller(appRouter);
```

### 4. `createMockServices()`

Standard mock service setup for issue operations.

```typescript
import { createMockServices } from "~/test/testDataFactories";

const mockServices = createMockServices();
// Provides mocked versions of:
// - createNotificationService
// - createIssueActivityService
// - createCollectionService, etc.
```

### 5. `createIssueDbMocks(context)`

Database mock helpers for issue testing.

```typescript
import {
  createIssueDbMocks,
  createIssueTestScenarios,
} from "~/test/testDataFactories";

const dbMocks = createIssueDbMocks(context);
const testIssue = createIssueTestScenarios.newIssue();

// Setup methods:
dbMocks.setupIssueFound(testIssue);
dbMocks.setupIssueNotFound();
dbMocks.setupMachineFound(machine);
dbMocks.setupIssueCreation(createdIssue);

// Drizzle support:
dbMocks.setupDrizzleIssueQuery(drizzleContext, issue);
dbMocks.setupDrizzleIssueInsert(drizzleContext, createdIssue);
```

### 6. `createPermissionTestScenarios`

Predefined permission sets and context creation by role.

```typescript
import { createPermissionTestScenarios } from "~/test/testDataFactories";

// Available permission sets:
const adminPermissions = createPermissionTestScenarios.adminPermissions;
const technicianPermissions =
  createPermissionTestScenarios.technicianPermissions;
const memberPermissions = createPermissionTestScenarios.memberPermissions;

// Quick context creation:
const { context } =
  createPermissionTestScenarios.createContextWithRole("adminPermissions");
```

### 7. `createIssueIntegrationTestHelpers`

Helpers specifically for PGlite integration tests.

```typescript
import { createIssueIntegrationTestHelpers } from "~/test/testDataFactories";

// For integration tests:
const testContext = createIssueIntegrationTestHelpers.createTestContext(
  txDb,
  seededData,
);
const issueData = createIssueIntegrationTestHelpers.createIntegrationIssueData(
  seededData,
  {
    title: "Custom Test Issue",
  },
);
```

## Migration Examples

### Before (Duplicated Setup)

```typescript
// Repeated in every test file
const mockUser = {
  id: "user-1",
  email: "test@example.com",
  user_metadata: { name: "Test User" },
  app_metadata: { organization_id: "org-1" },
};

const mockMembership = {
  id: "membership-1",
  userId: "user-1",
  organizationId: "org-1",
  // ... 20+ lines of boilerplate
};

// Complex permission setup
const mockServices = {
  createNotificationService: vi.fn(() => ({
    // ... repeated service mocks
  })),
  // ... more services
};
```

### After (Using Factories)

```typescript
import {
  createTRPCCallerForIssues,
  createIssueTestScenarios,
} from "~/test/testDataFactories";

// Clean, reusable setup
const { context, createCaller } = createTRPCCallerForIssues({
  permissions: ["issue:view", "issue:edit"],
  role: "Technician",
});

const caller = createCaller(appRouter);
const testIssue = createIssueTestScenarios.newIssue();
```

## Benefits

1. **Reduced Duplication**: Common setup patterns centralized in factories
2. **Consistent Test Data**: Standardized issue, user, and context creation
3. **Easy Customization**: Override defaults while maintaining good defaults
4. **Better Maintainability**: Changes to test patterns only need to be made in one place
5. **Comprehensive Coverage**: Support for unit tests, integration tests, and permission testing
6. **Modern Patterns**: Built for August 2025 testing best practices with Vitest and PGlite

## Usage in Existing Test Files

These factories are designed to be gradually adopted in existing test files. You can replace duplicate setup code incrementally while maintaining the same test logic and assertions.
