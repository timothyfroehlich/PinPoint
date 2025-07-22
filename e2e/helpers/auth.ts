import { type Page } from "@playwright/test";

export interface UserPermissions {
  "issue:view"?: boolean;
  "issue:edit"?: boolean;
  "issue:create"?: boolean;
  "issue:assign"?: boolean;
  "issue:delete"?: boolean;
  "issue:bulk_manage"?: boolean;
  "machine:view"?: boolean;
  "machine:create"?: boolean;
  "machine:edit"?: boolean;
  "machine:delete"?: boolean;
  "location:view"?: boolean;
  "location:create"?: boolean;
  "location:edit"?: boolean;
  "location:delete"?: boolean;
  "attachment:view"?: boolean;
  "attachment:create"?: boolean;
  "attachment:delete"?: boolean;
  "organization:manage"?: boolean;
  "role:manage"?: boolean;
  "user:manage"?: boolean;
  "admin:view_analytics"?: boolean;
}

/**
 * Login as a technician with standard technician permissions
 */
export async function loginAsTechnician(page: Page) {
  const permissions: UserPermissions = {
    "issue:view": true,
    "issue:edit": true,
    "issue:assign": true,
    "issue:delete": true,
    "machine:view": true,
    "location:view": true,
    "attachment:view": true,
    "attachment:create": true,
  };

  await loginAsUserWithPermissions(page, permissions, {
    id: "technician-1",
    name: "Test Technician",
    email: "technician@example.com",
  });
}

/**
 * Login as an admin with all permissions
 */
export async function loginAsAdmin(page: Page) {
  const permissions: UserPermissions = {
    "issue:view": true,
    "issue:edit": true,
    "issue:create": true,
    "issue:assign": true,
    "issue:delete": true,
    "issue:bulk_manage": true,
    "machine:view": true,
    "machine:create": true,
    "machine:edit": true,
    "machine:delete": true,
    "location:view": true,
    "location:create": true,
    "location:edit": true,
    "location:delete": true,
    "attachment:view": true,
    "attachment:create": true,
    "attachment:delete": true,
    "organization:manage": true,
    "role:manage": true,
    "user:manage": true,
    "admin:view_analytics": true,
  };

  await loginAsUserWithPermissions(page, permissions, {
    id: "admin-1",
    name: "Test Admin",
    email: "admin@example.com",
  });
}

/**
 * Login as a user with specific permissions
 */
export async function loginAsUserWithPermissions(
  page: Page,
  permissions: UserPermissions,
  user?: {
    id: string;
    name: string;
    email: string;
  },
) {
  const defaultUser = {
    id: "test-user-1",
    name: "Test User",
    email: "test@example.com",
  };

  const userInfo = user || defaultUser;

  // Convert permissions object to array format
  const permissionsList = Object.entries(permissions)
    .filter(([, enabled]) => enabled)
    .map(([permission]) => permission);

  // Mock the session in localStorage or via API
  // TODO: This depends on how authentication is implemented in the app
  // For now, we'll simulate it by setting up the session state

  await page.addInitScript(
    (userData) => {
      // Mock the session in window object for client-side checks
      (window as { __TEST_SESSION__?: unknown }).__TEST_SESSION__ = {
        user: {
          ...userData.user,
          permissions: userData.permissions,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    },
    { user: userInfo, permissions: permissionsList },
  );

  // TODO: Set up actual authentication cookies/tokens based on app implementation
  // This might involve:
  // 1. Making API calls to create a test session
  // 2. Setting authentication cookies
  // 3. Redirecting through the login flow
}

/**
 * Login as a regular user with minimal permissions
 */
export async function loginAsRegularUser(page: Page) {
  const permissions: UserPermissions = {
    "issue:view": true,
    "issue:create": true,
    "machine:view": true,
    "location:view": true,
    "attachment:view": true,
    "attachment:create": true,
  };

  await loginAsUserWithPermissions(page, permissions, {
    id: "user-1",
    name: "Regular User",
    email: "user@example.com",
  });
}

/**
 * Logout the current user
 */
export async function logout(page: Page) {
  await page.addInitScript(() => {
    // Clear test session
    delete (window as { __TEST_SESSION__?: unknown }).__TEST_SESSION__;
  });

  // TODO: Clear authentication cookies/tokens
  // This might involve:
  // 1. Making API calls to destroy the session
  // 2. Clearing authentication cookies
  // 3. Redirecting to logout endpoint
}

/**
 * Setup test data for issues
 */
export async function setupTestIssue(
  page: Page,
  issueData?: Record<string, unknown>,
) {
  const defaultIssue = {
    id: "test-issue-1",
    title: "Test Issue Title",
    description: "Test issue description",
    status: { id: "status-1", name: "Open", color: "#ff0000" },
    priority: { id: "priority-1", name: "Medium", color: "#ffaa00" },
    machine: {
      id: "machine-1",
      serialNumber: "TEST123",
      model: {
        name: "Test Game",
        manufacturer: "Test Manufacturer",
      },
      location: {
        name: "Test Location",
        address: "123 Test St",
      },
    },
    createdBy: {
      id: "user-1",
      name: "Test User",
    },
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    comments: [],
    attachments: [],
  };

  const issue = { ...defaultIssue, ...issueData };

  // Mock the API response for this issue
  await page.route(`**/api/trpc/issue.core.getById*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: { data: issue } }),
    });
  });

  return issue;
}
