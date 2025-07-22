import { test, expect } from "@playwright/test";
import { loginAsUserWithPermissions, setupTestIssue } from "../helpers/auth";

test.describe("Issue Detail - Permission Matrix", () => {
  test.beforeEach(async ({ page }) => {
    // Set up test data
    await setupTestIssue(page);
  });

  test.describe("Read Permissions", () => {
    test("allows users with issue:view to view issue details", async ({
      page,
    }) => {
      await loginAsUserWithPermissions(page, { "issue:view": true });

      await page.goto("/issues/test-issue-1");

      // Should see basic issue information
      await expect(page.locator('[data-testid="issue-title"]')).toBeVisible();
      await expect(
        page.locator('[data-testid="issue-description"]'),
      ).toBeVisible();
      await expect(page.locator('[data-testid="issue-status"]')).toBeVisible();
      await expect(
        page.locator('[data-testid="public-comments"]'),
      ).toBeVisible();

      // Should NOT see edit controls
      await expect(
        page.locator('[data-testid="edit-issue-button"]'),
      ).not.toBeVisible();
      await expect(
        page.locator('[data-testid="status-dropdown"]'),
      ).not.toBeVisible();
      await expect(
        page.locator('[data-testid="assign-user-button"]'),
      ).not.toBeVisible();
    });

    test("denies users without issue:view from viewing issues", async ({
      page,
    }) => {
      // Login with no permissions
      await loginAsUserWithPermissions(page, {});

      await page.goto("/issues/test-issue-1");

      // Should show permission denied
      await expect(
        page.locator('[data-testid="permission-denied"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="permission-denied"]'),
      ).toContainText("You do not have permission to view this issue");
    });
  });

  test.describe("Edit Permissions", () => {
    test("shows edit button only with issue:edit permission", async ({
      page,
    }) => {
      // Login with view and edit permissions
      await loginAsUserWithPermissions(page, {
        "issue:view": true,
        "issue:edit": true,
      });

      await page.goto("/issues/test-issue-1");

      // Should see edit controls
      await expect(
        page.locator('[data-testid="edit-issue-button"]'),
      ).toBeVisible();

      // Should be able to edit title and description
      await page.locator('[data-testid="edit-issue-button"]').click();
      await expect(page.locator('[data-testid="title-input"]')).toBeVisible();
      await expect(
        page.locator('[data-testid="description-textarea"]'),
      ).toBeVisible();
    });

    test("shows disabled edit button without issue:edit permission", async ({
      page,
    }) => {
      // Login with only view permission
      await loginAsUserWithPermissions(page, { "issue:view": true });

      await page.goto("/issues/test-issue-1");

      // PermissionButton should show as disabled with tooltip
      const editButton = page.locator('[data-testid="edit-issue-button"]');
      await expect(editButton).toBeVisible();
      await expect(editButton).toBeDisabled();

      // Hover to see tooltip
      await editButton.hover();
      const tooltip = page.locator('div[role="tooltip"]');
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText("edit");
    });

    test("allows status changes with issue:edit permission", async ({
      page,
    }) => {
      // Login with view and edit permissions
      await loginAsUserWithPermissions(page, {
        "issue:view": true,
        "issue:edit": true,
      });

      await page.goto("/issues/test-issue-1");

      // Should see status control section with edit permission
      const statusSection = page.locator('[data-testid="status-control"]');
      await expect(statusSection).toBeVisible();

      // Note: Actual status change testing would require
      // mocking the tRPC mutation endpoints appropriately
    });
  });

  test.describe("Close Permissions", () => {
    test("shows close button only with issue:edit permission", async ({
      page,
    }) => {
      // Login with view and edit permissions
      await loginAsUserWithPermissions(page, {
        "issue:view": true,
        "issue:edit": true,
      });

      await page.goto("/issues/test-issue-1");

      // Should see close button (uses issue:edit permission)
      await expect(
        page.locator('[data-testid="close-issue-button"]'),
      ).toBeVisible();
    });

    test.fixme(
      "hides close button without issues:close permission",
      async ({ page }) => {
        // TODO: Implementation agent will complete this test
        // await loginAsUserWithPermissions(page, ['issues:read', 'issues:edit']);

        await page.goto("/issues/test-issue-1");

        // Should NOT see close controls
        await expect(
          page.locator('[data-testid="close-issue-button"]'),
        ).not.toBeVisible();
        await expect(
          page.locator('[data-testid="resolve-button"]'),
        ).not.toBeVisible();

        // Should show disabled close button with tooltip
        await expect(
          page.locator('[data-testid="disabled-close-button"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="disabled-close-button"]'),
        ).toHaveAttribute(
          "title",
          "You need close permissions to close this issue",
        );
      },
    );

    test.fixme(
      "allows issue resolution with issues:close permission",
      async ({ page }) => {
        // TODO: Implementation agent will complete this test
        // await loginAsUserWithPermissions(page, ['issues:read', 'issues:close']);

        await page.goto("/issues/test-issue-1");

        // Should be able to resolve issue
        await page.locator('[data-testid="resolve-button"]').click();
        await page
          .locator('[data-testid="resolution-textarea"]')
          .fill("Issue resolved by cleaning contacts");
        await page.locator('[data-testid="confirm-resolution"]').click();

        // Should see resolution
        await expect(
          page.locator('[data-testid="issue-status"]'),
        ).toContainText("Resolved");
        await expect(
          page.locator('[data-testid="resolution-note"]'),
        ).toContainText("Issue resolved by cleaning contacts");
      },
    );
  });

  test.describe("Assign Permissions", () => {
    test("shows assign control only with issue:assign permission", async ({
      page,
    }) => {
      // Login with view and assign permissions
      await loginAsUserWithPermissions(page, {
        "issue:view": true,
        "issue:assign": true,
      });

      await page.goto("/issues/test-issue-1");

      // Should see assign button
      await expect(
        page.locator('[data-testid="assign-user-button"]'),
      ).toBeVisible();
    });

    test.fixme(
      "hides assign control without issues:assign permission",
      async ({ page }) => {
        // TODO: Implementation agent will complete this test
        // await loginAsUserWithPermissions(page, ['issues:read', 'issues:edit']);

        await page.goto("/issues/test-issue-1");

        // Should NOT see assign controls
        await expect(
          page.locator('[data-testid="assign-user-button"]'),
        ).not.toBeVisible();

        // Should show disabled assign button with tooltip
        await expect(
          page.locator('[data-testid="disabled-assign-button"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="disabled-assign-button"]'),
        ).toHaveAttribute(
          "title",
          "You need assign permissions to assign this issue",
        );
      },
    );

    test.fixme(
      "allows self-assignment with issues:assign permission",
      async ({ page }) => {
        // TODO: Implementation agent will complete this test
        // await loginAsUserWithPermissions(page, ['issues:read', 'issues:assign']);

        await page.goto("/issues/test-issue-unassigned");

        // Should be able to assign to self
        await page.locator('[data-testid="assign-to-self"]').click();
        await page.locator('[data-testid="confirm-assignment"]').click();

        // Should see assignment
        await expect(page.locator('[data-testid="assigned-to"]')).toContainText(
          "Test User",
        );
        await expect(
          page.locator('[data-testid="assignment-activity"]'),
        ).toBeVisible();
      },
    );
  });

  test.describe("Comment Permissions", () => {
    test.fixme(
      "allows public comments with issues:comment permission",
      async ({ page }) => {
        // TODO: Implementation agent will complete this test
        // await loginAsUserWithPermissions(page, ['issues:read', 'issues:comment']);

        await page.goto("/issues/test-issue-1");

        // Should be able to add public comment
        await page.locator('[data-testid="add-comment-button"]').click();
        await page
          .locator('[data-testid="comment-textarea"]')
          .fill("Public comment from user");
        await page.locator('[data-testid="submit-comment-button"]').click();

        // Should see comment added
        await expect(
          page.locator('[data-testid="latest-comment"]'),
        ).toContainText("Public comment from user");
        await expect(
          page.locator('[data-testid="public-badge"]'),
        ).toBeVisible();
      },
    );

    test.fixme(
      "allows internal comments with issues:internal_comment permission",
      async ({ page }) => {
        // TODO: Implementation agent will complete this test
        // await loginAsUserWithPermissions(page, ['issues:read', 'issues:comment', 'issues:internal_comment']);

        await page.goto("/issues/test-issue-1");

        // Should see internal comment toggle
        await page.locator('[data-testid="add-comment-button"]').click();
        await expect(
          page.locator('[data-testid="internal-comment-toggle"]'),
        ).toBeVisible();

        // Should be able to add internal comment
        await page
          .locator('[data-testid="comment-textarea"]')
          .fill("Internal note for technicians");
        await page.locator('[data-testid="internal-comment-toggle"]').click();
        await page.locator('[data-testid="submit-comment-button"]').click();

        // Should see internal comment added
        await expect(
          page.locator('[data-testid="latest-comment"]'),
        ).toContainText("Internal note for technicians");
        await expect(
          page.locator('[data-testid="internal-badge"]'),
        ).toBeVisible();
      },
    );

    test.fixme(
      "hides internal comment toggle without issues:internal_comment permission",
      async ({ page }) => {
        // TODO: Implementation agent will complete this test
        // await loginAsUserWithPermissions(page, ['issues:read', 'issues:comment']);

        await page.goto("/issues/test-issue-1");

        // Should NOT see internal comment toggle
        await page.locator('[data-testid="add-comment-button"]').click();
        await expect(
          page.locator('[data-testid="internal-comment-toggle"]'),
        ).not.toBeVisible();

        // Should only be able to add public comments
        await page
          .locator('[data-testid="comment-textarea"]')
          .fill("Public comment only");
        await page.locator('[data-testid="submit-comment-button"]').click();

        await expect(
          page.locator('[data-testid="latest-comment"]'),
        ).toContainText("Public comment only");
        await expect(
          page.locator('[data-testid="public-badge"]'),
        ).toBeVisible();
      },
    );

    test("hides comment form without issue:create permission", async ({
      page,
    }) => {
      // Login with only view permission (no comment/create permission)
      await loginAsUserWithPermissions(page, { "issue:view": true });

      await page.goto("/issues/test-issue-1");

      // PermissionGate should hide the comment form
      await expect(
        page.locator('[data-testid="comment-form"]'),
      ).not.toBeVisible();
    });
  });

  test.describe("Delete Permissions", () => {
    test.fixme(
      "shows delete controls only with issues:delete permission",
      async ({ page }) => {
        // TODO: Implementation agent will complete this test
        // await loginAsUserWithPermissions(page, ['issues:read', 'issues:delete']);

        await page.goto("/issues/test-issue-1");

        // Should see delete controls
        await expect(
          page.locator('[data-testid="delete-issue-button"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="danger-actions"]'),
        ).toBeVisible();
      },
    );

    test.fixme(
      "hides delete controls without issues:delete permission",
      async ({ page }) => {
        // TODO: Implementation agent will complete this test
        // await loginAsUserWithPermissions(page, ['issues:read', 'issues:edit']);

        await page.goto("/issues/test-issue-1");

        // Should NOT see delete controls
        await expect(
          page.locator('[data-testid="delete-issue-button"]'),
        ).not.toBeVisible();
        await expect(
          page.locator('[data-testid="danger-actions"]'),
        ).not.toBeVisible();
      },
    );

    test.fixme(
      "allows issue deletion with issues:delete permission",
      async ({ page }) => {
        // TODO: Implementation agent will complete this test
        // await loginAsUserWithPermissions(page, ['issues:read', 'issues:delete']);

        await page.goto("/issues/test-issue-deletable");

        // Should be able to delete issue
        await page.locator('[data-testid="delete-issue-button"]').click();
        await page.locator('[data-testid="confirm-delete-checkbox"]').click();
        await page.locator('[data-testid="confirm-delete-button"]').click();

        // Should redirect to dashboard
        expect(page.url()).toContain("/dashboard");

        // Should show deletion success message
        await expect(
          page.locator('[data-testid="deletion-success"]'),
        ).toBeVisible();
      },
    );
  });

  test.describe("Admin Permissions", () => {
    test.fixme(
      "shows all controls with admin permissions",
      async ({ page }) => {
        // TODO: Implementation agent will complete this test
        // await loginAsAdmin(page);

        await page.goto("/issues/test-issue-1");

        // Should see all controls
        await expect(
          page.locator('[data-testid="edit-issue-button"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="assign-user-button"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="close-issue-button"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="delete-issue-button"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="status-dropdown"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="priority-dropdown"]'),
        ).toBeVisible();

        // Should see admin-only controls
        await expect(
          page.locator('[data-testid="admin-actions"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="transfer-issue-button"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="audit-log-button"]'),
        ).toBeVisible();
      },
    );

    test.fixme("allows admin-only actions", async ({ page }) => {
      // TODO: Implementation agent will complete this test
      // await loginAsAdmin(page);

      await page.goto("/issues/test-issue-1");

      // Should be able to transfer issue to another organization
      await page.locator('[data-testid="transfer-issue-button"]').click();
      await page.locator('[data-testid="target-organization-select"]').click();
      await page.locator('[data-testid="organization-option-2"]').click();
      await page.locator('[data-testid="confirm-transfer"]').click();

      // Should see transfer confirmation
      await expect(
        page.locator('[data-testid="transfer-success"]'),
      ).toBeVisible();
    });
  });

  test.describe("Role-based Access", () => {
    test.fixme("member role shows basic permissions", async ({ page }) => {
      // TODO: Implementation agent will complete this test
      // await loginAsRole(page, 'member');

      await page.goto("/issues/test-issue-1");

      // Should see read and comment permissions
      await expect(page.locator('[data-testid="issue-title"]')).toBeVisible();
      await expect(
        page.locator('[data-testid="add-comment-button"]'),
      ).toBeVisible();

      // Should NOT see edit permissions
      await expect(
        page.locator('[data-testid="edit-issue-button"]'),
      ).not.toBeVisible();
      await expect(
        page.locator('[data-testid="status-dropdown"]'),
      ).not.toBeVisible();
    });

    test.fixme(
      "technician role shows extended permissions",
      async ({ page }) => {
        // TODO: Implementation agent will complete this test
        // await loginAsRole(page, 'technician');

        await page.goto("/issues/test-issue-1");

        // Should see most permissions
        await expect(
          page.locator('[data-testid="edit-issue-button"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="assign-user-button"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="close-issue-button"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="internal-comment-toggle"]'),
        ).toBeVisible();

        // Should NOT see admin-only permissions
        await expect(
          page.locator('[data-testid="delete-issue-button"]'),
        ).not.toBeVisible();
        await expect(
          page.locator('[data-testid="transfer-issue-button"]'),
        ).not.toBeVisible();
      },
    );

    test.fixme("owner role shows ownership permissions", async ({ page }) => {
      // TODO: Implementation agent will complete this test
      // await loginAsMachineOwner(page);

      await page.goto("/issues/test-issue-owned-machine");

      // Should see owner-specific permissions
      await expect(page.locator('[data-testid="owner-badge"]')).toBeVisible();
      await expect(page.locator('[data-testid="owner-actions"]')).toBeVisible();
      await expect(
        page.locator('[data-testid="priority-request-button"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="notification-settings"]'),
      ).toBeVisible();
    });
  });

  test.describe("Dynamic Permission Updates", () => {
    test.fixme("updates UI when permissions change", async ({ page }) => {
      // TODO: Implementation agent will complete this test
      // await loginAsUserWithPermissions(page, ['issues:read']);

      await page.goto("/issues/test-issue-1");

      // Initially should NOT see edit button
      await expect(
        page.locator('[data-testid="edit-issue-button"]'),
      ).not.toBeVisible();

      // Simulate permission grant (via WebSocket or polling)
      // await grantPermissionToUser(page, 'issues:edit');

      // Should now see edit button
      await expect(
        page.locator('[data-testid="edit-issue-button"]'),
      ).toBeVisible();

      // Should be able to use new permission
      await page.locator('[data-testid="edit-issue-button"]').click();
      await expect(page.locator('[data-testid="title-input"]')).toBeVisible();
    });
  });

  test.describe("Permission Tooltips and Feedback", () => {
    test.fixme(
      "displays permission tooltips on disabled buttons",
      async ({ page }) => {
        // TODO: Implementation agent will complete this test
        // await loginAsUserWithPermissions(page, ['issues:read']);

        await page.goto("/issues/test-issue-1");

        // Should show tooltips on disabled buttons
        await expect(
          page.locator('[data-testid="disabled-edit-button"]'),
        ).toHaveAttribute(
          "title",
          "You need edit permissions to modify this issue",
        );

        await expect(
          page.locator('[data-testid="disabled-assign-button"]'),
        ).toHaveAttribute(
          "title",
          "You need assign permissions to assign this issue",
        );

        await expect(
          page.locator('[data-testid="disabled-close-button"]'),
        ).toHaveAttribute(
          "title",
          "You need close permissions to close this issue",
        );
      },
    );

    test.fixme("shows permission request options", async ({ page }) => {
      // TODO: Implementation agent will complete this test
      // await loginAsUserWithPermissions(page, ['issues:read']);

      await page.goto("/issues/test-issue-1");

      // Should show request permission options
      await expect(
        page.locator('[data-testid="request-permissions"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="request-edit-permission"]'),
      ).toBeVisible();

      // Should be able to request permissions
      await page.locator('[data-testid="request-edit-permission"]').click();
      await expect(
        page.locator('[data-testid="permission-request-sent"]'),
      ).toBeVisible();
    });
  });
});
