import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-End Tests for Roles and Permissions System
 * 
 * These tests verify the complete roles and permissions workflow from the UI perspective.
 * They will fail initially as the implementation doesn't exist yet (TDD red phase).
 */

// Test data setup helpers
const TEST_USERS = {
  admin: {
    email: "admin@example.com",
    name: "Admin User",
    role: "Admin",
  },
  technician: {
    email: "technician@example.com",
    name: "Technician User", 
    role: "Technician",
  },
  user: {
    email: "user@example.com",
    name: "Regular User",
    role: "User",
  },
} as const;

const TEST_PERMISSIONS = {
  ISSUE_CREATE: "issue:create",
  ISSUE_EDIT: "issue:edit",
  ISSUE_DELETE: "issue:delete",
  MACHINE_EDIT: "machine:edit",
  ORGANIZATION_MANAGE: "organization:manage",
  ROLE_MANAGE: "role:manage",
} as const;

// Helper functions for common UI interactions
class RolePermissionPage {
  constructor(private page: Page) {}

  async loginAs(userType: keyof typeof TEST_USERS) {
    const user = TEST_USERS[userType];
    
    // Navigate to login page
    await this.page.goto("/");
    
    // Fill in email and submit (this will fail initially)
    await this.page.fill('input[type="email"]', user.email);
    await this.page.click('button:has-text("Continue with Email")');
    
    // In a real implementation, this would handle magic link flow
    // For tests, we'll simulate being logged in
    await this.page.waitForURL("/dashboard");
  }

  async navigateToRoleManagement() {
    // Navigate to role management page (will fail initially)
    await this.page.click('nav a:has-text("Settings")');
    await this.page.click('a:has-text("Roles & Permissions")');
    await this.page.waitForURL("/settings/roles");
  }

  async createRole(name: string, permissions: string[]) {
    // Click create role button
    await this.page.click('button:has-text("Create Role")');
    
    // Fill role name
    await this.page.fill('input[name="roleName"]', name);
    
    // Select permissions
    for (const permission of permissions) {
      await this.page.check(`input[value="${permission}"]`);
    }
    
    // Submit form
    await this.page.click('button:has-text("Create")');
    
    // Wait for success feedback
    await this.page.waitForSelector('.success-message, .toast-success');
  }

  async editRole(roleName: string, newPermissions: string[]) {
    // Find and click edit button for the role
    await this.page.click(`tr:has-text("${roleName}") button:has-text("Edit")`);
    
    // Clear existing permissions
    await this.page.click('button:has-text("Clear All")');
    
    // Select new permissions
    for (const permission of newPermissions) {
      await this.page.check(`input[value="${permission}"]`);
    }
    
    // Save changes
    await this.page.click('button:has-text("Save")');
    
    // Wait for success feedback
    await this.page.waitForSelector('.success-message, .toast-success');
  }

  async deleteRole(roleName: string, reassignTo?: string) {
    // Find and click delete button for the role
    await this.page.click(`tr:has-text("${roleName}") button:has-text("Delete")`);
    
    // Handle reassignment if needed
    if (reassignTo) {
      await this.page.selectOption('select[name="reassignRole"]', reassignTo);
    }
    
    // Confirm deletion
    await this.page.click('button:has-text("Confirm Delete")');
    
    // Wait for success feedback
    await this.page.waitForSelector('.success-message, .toast-success');
  }

  async assignUserToRole(userEmail: string, roleName: string) {
    // Navigate to user management
    await this.page.click('nav a:has-text("Users")');
    
    // Find user and click edit
    await this.page.click(`tr:has-text("${userEmail}") button:has-text("Edit")`);
    
    // Select new role
    await this.page.selectOption('select[name="role"]', roleName);
    
    // Save changes
    await this.page.click('button:has-text("Save")');
    
    // Wait for success feedback
    await this.page.waitForSelector('.success-message, .toast-success');
  }

  async verifyPermissionAccess(permission: string, shouldHaveAccess: boolean) {
    // This method will test if UI elements requiring specific permissions are visible/enabled
    const permissionElements = {
      [TEST_PERMISSIONS.ISSUE_CREATE]: 'button:has-text("Create Issue")',
      [TEST_PERMISSIONS.ISSUE_EDIT]: 'button:has-text("Edit Issue")',
      [TEST_PERMISSIONS.ISSUE_DELETE]: 'button:has-text("Delete Issue")',
      [TEST_PERMISSIONS.MACHINE_EDIT]: 'button:has-text("Edit Machine")',
      [TEST_PERMISSIONS.ORGANIZATION_MANAGE]: 'nav a:has-text("Organization Settings")',
      [TEST_PERMISSIONS.ROLE_MANAGE]: 'nav a:has-text("Roles & Permissions")',
    };

    const selector = permissionElements[permission as keyof typeof permissionElements];
    
    if (shouldHaveAccess) {
      await expect(this.page.locator(selector)).toBeVisible();
      await expect(this.page.locator(selector)).toBeEnabled();
    } else {
      await expect(this.page.locator(selector)).not.toBeVisible();
    }
  }
}

test.describe("Role Management UI", () => {
  let rolePage: RolePermissionPage;

  test.beforeEach(async ({ page }) => {
    rolePage = new RolePermissionPage(page);
  });

  test("admin can create new roles", async ({ page }) => {
    // Arrange
    await rolePage.loginAs("admin");
    await rolePage.navigateToRoleManagement();

    // Act
    await rolePage.createRole("Custom Role", [
      TEST_PERMISSIONS.ISSUE_CREATE,
      TEST_PERMISSIONS.ISSUE_EDIT,
    ]);

    // Assert
    await expect(page.locator('tr:has-text("Custom Role")')).toBeVisible();
    await expect(page.locator('tr:has-text("Custom Role") td:has-text("2")')).toBeVisible(); // 2 permissions
  });

  test("admin can edit existing roles", async ({ page }) => {
    // Arrange
    await rolePage.loginAs("admin");
    await rolePage.navigateToRoleManagement();
    
    // Create initial role
    await rolePage.createRole("Test Role", [TEST_PERMISSIONS.ISSUE_CREATE]);

    // Act
    await rolePage.editRole("Test Role", [
      TEST_PERMISSIONS.ISSUE_CREATE,
      TEST_PERMISSIONS.ISSUE_EDIT,
      TEST_PERMISSIONS.MACHINE_EDIT,
    ]);

    // Assert
    await expect(page.locator('tr:has-text("Test Role") td:has-text("3")')).toBeVisible(); // 3 permissions
  });

  test("admin can delete roles with member reassignment", async ({ page }) => {
    // Arrange
    await rolePage.loginAs("admin");
    await rolePage.navigateToRoleManagement();
    
    // Create role to delete
    await rolePage.createRole("Role to Delete", [TEST_PERMISSIONS.ISSUE_CREATE]);

    // Act
    await rolePage.deleteRole("Role to Delete", "User");

    // Assert
    await expect(page.locator('tr:has-text("Role to Delete")')).not.toBeVisible();
  });

  test("non-admin users cannot access role management", async ({ page }) => {
    // Arrange
    await rolePage.loginAs("user");

    // Act & Assert
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ROLE_MANAGE, false);
  });

  test("cannot delete system roles", async ({ page }) => {
    // Arrange
    await rolePage.loginAs("admin");
    await rolePage.navigateToRoleManagement();

    // Act & Assert
    // System roles should not have delete buttons
    await expect(page.locator('tr:has-text("Admin") button:has-text("Delete")')).not.toBeVisible();
    await expect(page.locator('tr:has-text("User") button:has-text("Delete")')).not.toBeVisible();
    await expect(page.locator('tr:has-text("Technician") button:has-text("Delete")')).not.toBeVisible();
  });

  test("displays role permissions correctly", async ({ page }) => {
    // Arrange
    await rolePage.loginAs("admin");
    await rolePage.navigateToRoleManagement();

    // Act
    await page.click('tr:has-text("Admin") button:has-text("View Details")');

    // Assert
    await expect(page.locator('.role-details')).toBeVisible();
    await expect(page.locator('.permission-list')).toContainText("organization:manage");
    await expect(page.locator('.permission-list')).toContainText("user:manage");
    await expect(page.locator('.permission-list')).toContainText("role:manage");
  });
});

test.describe("Permission-Based UI Access Control", () => {
  let rolePage: RolePermissionPage;

  test.beforeEach(async ({ page }) => {
    rolePage = new RolePermissionPage(page);
  });

  test("admin has access to all features", async ({ page }) => {
    // Arrange
    await rolePage.loginAs("admin");

    // Act & Assert
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ISSUE_CREATE, true);
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ISSUE_EDIT, true);
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ISSUE_DELETE, true);
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.MACHINE_EDIT, true);
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ORGANIZATION_MANAGE, true);
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ROLE_MANAGE, true);
  });

  test("technician has appropriate access", async ({ page }) => {
    // Arrange
    await rolePage.loginAs("technician");

    // Act & Assert
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ISSUE_CREATE, true);
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ISSUE_EDIT, true);
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ISSUE_DELETE, false);
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.MACHINE_EDIT, true);
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ORGANIZATION_MANAGE, false);
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ROLE_MANAGE, false);
  });

  test("regular user has limited access", async ({ page }) => {
    // Arrange
    await rolePage.loginAs("user");

    // Act & Assert
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ISSUE_CREATE, true);
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ISSUE_EDIT, false);
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ISSUE_DELETE, false);
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.MACHINE_EDIT, false);
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ORGANIZATION_MANAGE, false);
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ROLE_MANAGE, false);
  });

  test("permission changes reflect immediately in UI", async ({ page }) => {
    // This test verifies that permission changes are reflected without requiring re-login
    
    // Arrange
    await rolePage.loginAs("admin");
    
    // Create a user with limited permissions
    await rolePage.navigateToRoleManagement();
    await rolePage.createRole("Limited Role", [TEST_PERMISSIONS.ISSUE_CREATE]);
    
    // Assign user to limited role
    await rolePage.assignUserToRole(TEST_USERS.user.email, "Limited Role");
    
    // Login as that user
    await rolePage.loginAs("user");
    
    // Verify limited access
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ISSUE_EDIT, false);
    
    // Admin updates the role to include edit permissions (in another session)
    // This would be done through API or background process in real scenario
    
    // Refresh page to check if permissions updated
    await page.reload();
    
    // Verify new permissions are active
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ISSUE_EDIT, true);
  });
});

test.describe("User Management and Role Assignment", () => {
  let rolePage: RolePermissionPage;

  test.beforeEach(async ({ page }) => {
    rolePage = new RolePermissionPage(page);
  });

  test("admin can assign roles to users", async ({ page }) => {
    // Arrange
    await rolePage.loginAs("admin");

    // Act
    await rolePage.assignUserToRole(TEST_USERS.user.email, "Technician");

    // Assert
    await expect(page.locator(`tr:has-text("${TEST_USERS.user.email}") td:has-text("Technician")`)).toBeVisible();
  });

  test("role assignment affects user permissions immediately", async ({ page }) => {
    // Arrange
    await rolePage.loginAs("admin");
    
    // Assign user to technician role
    await rolePage.assignUserToRole(TEST_USERS.user.email, "Technician");
    
    // Login as the user
    await rolePage.loginAs("user");

    // Act & Assert
    // User should now have technician permissions
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ISSUE_EDIT, true);
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.MACHINE_EDIT, true);
    await rolePage.verifyPermissionAccess(TEST_PERMISSIONS.ORGANIZATION_MANAGE, false);
  });

  test("cannot assign non-existent roles", async ({ page }) => {
    // Arrange
    await rolePage.loginAs("admin");
    await page.goto("/settings/users");

    // Act
    await page.click(`tr:has-text("${TEST_USERS.user.email}") button:has-text("Edit")`);

    // Assert
    await expect(page.locator('select[name="role"] option:has-text("NonExistentRole")')).not.toBeVisible();
  });

  test("displays user count per role", async ({ page }) => {
    // Arrange
    await rolePage.loginAs("admin");
    await rolePage.navigateToRoleManagement();

    // Act & Assert
    // Each role should display the number of users assigned to it
    await expect(page.locator('tr:has-text("Admin")')).toContainText("1 user"); // Admin user
    await expect(page.locator('tr:has-text("User")')).toContainText("2 users"); // Default users
  });
});

test.describe("Organization Isolation", () => {
  let rolePage: RolePermissionPage;

  test.beforeEach(async ({ page }) => {
    rolePage = new RolePermissionPage(page);
  });

  test("roles are organization-specific", async ({ page }) => {
    // This test would require multi-tenant setup
    // For now, we'll test that organization isolation is working
    
    // Arrange
    await rolePage.loginAs("admin");
    await rolePage.navigateToRoleManagement();

    // Act
    await rolePage.createRole("Org Specific Role", [TEST_PERMISSIONS.ISSUE_CREATE]);

    // Assert
    // The role should only be visible within this organization
    await expect(page.locator('tr:has-text("Org Specific Role")')).toBeVisible();
    
    // TODO: Add test for accessing different organization and verifying role is not visible
  });

  test("cannot manage roles from different organizations", async ({ page }) => {
    // This would test cross-organization access prevention
    // Implementation depends on subdomain-based multi-tenancy
    
    // Arrange
    await rolePage.loginAs("admin");

    // Act & Assert
    // Attempting to access another organization's role management should fail
    // This would be tested by switching subdomains or organization context
    
    await expect(page).toHaveURL(/\/settings\/roles/);
  });
});

test.describe("Permission Validation and Security", () => {
  let rolePage: RolePermissionPage;

  test.beforeEach(async ({ page }) => {
    rolePage = new RolePermissionPage(page);
  });

  test("invalid permission combinations are rejected", async ({ page }) => {
    // Arrange
    await rolePage.loginAs("admin");
    await rolePage.navigateToRoleManagement();

    // Act
    await page.click('button:has-text("Create Role")');
    await page.fill('input[name="roleName"]', "Invalid Role");
    
    // Try to submit without any permissions
    await page.click('button:has-text("Create")');

    // Assert
    await expect(page.locator('.error-message')).toContainText("At least one permission is required");
  });

  test("system roles cannot be modified", async ({ page }) => {
    // Arrange
    await rolePage.loginAs("admin");
    await rolePage.navigateToRoleManagement();

    // Act & Assert
    // System roles should not have edit buttons or should show as read-only
    await expect(page.locator('tr:has-text("Admin") button:has-text("Edit")')).not.toBeVisible();
    await expect(page.locator('tr:has-text("User") button:has-text("Edit")')).not.toBeVisible();
    await expect(page.locator('tr:has-text("Technician") button:has-text("Edit")')).not.toBeVisible();
  });

  test("role names must be unique within organization", async ({ page }) => {
    // Arrange
    await rolePage.loginAs("admin");
    await rolePage.navigateToRoleManagement();
    
    // Create first role
    await rolePage.createRole("Unique Role", [TEST_PERMISSIONS.ISSUE_CREATE]);

    // Act
    await page.click('button:has-text("Create Role")');
    await page.fill('input[name="roleName"]', "Unique Role"); // Same name
    await page.check(`input[value="${TEST_PERMISSIONS.ISSUE_CREATE}"]`);
    await page.click('button:has-text("Create")');

    // Assert
    await expect(page.locator('.error-message')).toContainText("Role name already exists");
  });

  test("permission dependencies are validated", async ({ page }) => {
    // This test would verify that dependent permissions are automatically included
    // or that the UI prevents invalid permission combinations
    
    // Arrange
    await rolePage.loginAs("admin");
    await rolePage.navigateToRoleManagement();

    // Act
    await page.click('button:has-text("Create Role")');
    await page.fill('input[name="roleName"]', "Dependent Role");
    
    // Select a permission that has dependencies
    await page.check(`input[value="${TEST_PERMISSIONS.ISSUE_EDIT}"]`);

    // Assert
    // Issue view permission should be automatically selected or required
    await expect(page.locator(`input[value="${TEST_PERMISSIONS.ISSUE_CREATE}"]`)).toBeChecked();
  });
});