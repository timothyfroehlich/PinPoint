/**
 * E2E Tests: Comment Edit and Delete Actions
 *
 * Tests the comment edit/delete feature on issue detail pages:
 * - Authors can edit their own comments
 * - Authors can delete their own comments
 * - Admins can delete any comment
 * - Users cannot edit/delete others' comments (unless admin)
 */

import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import { cleanupTestEntities, extractIdFromUrl } from "../support/cleanup.js";
import { seededMachines, TEST_USERS } from "../support/constants.js";
import { fillReportForm } from "../support/page-helpers.js";

// Track created issues for cleanup
const createdIssueIds = new Set<string>();

// Test data - unique per run to avoid conflicts
const testId = Date.now();

function rememberIssueId(page: Page): void {
  const issueId = extractIdFromUrl(page.url());
  if (issueId) {
    createdIssueIds.add(issueId);
  }
}

async function createTestIssue(
  page: Page,
  testInfo: TestInfo
): Promise<string> {
  const machineInitials = seededMachines.medievalMadness.initials;

  // Navigate to report page
  await page.goto(`/report?machine=${machineInitials}`);

  // Fill out form
  await fillReportForm(page, {
    title: `Comment Test Issue ${testId}`,
    description: "Test issue for comment actions E2E tests",
    priority: "medium",
  });

  // Submit form
  await page.getByRole("button", { name: "Submit Issue Report" }).click();

  // Wait for redirect to issue detail page
  await expect(page).toHaveURL(/\/m\/[A-Z0-9]{2,6}\/i\/[0-9]+/, {
    timeout: 30000,
  });

  rememberIssueId(page);
  return page.url();
}

async function addComment(page: Page, content: string): Promise<void> {
  // The textarea has aria-label="Comment" per AddCommentForm.tsx
  const commentTextarea = page.getByRole("textbox", { name: "Comment" });
  await commentTextarea.fill(content);
  await page.getByRole("button", { name: "Add Comment" }).click();
  await page.waitForLoadState("networkidle");
  // Wait for comment to appear
  await expect(page.getByText(content)).toBeVisible({ timeout: 10000 });
}

function getCommentCard(page: Page, commentText: string) {
  return page
    .locator('[data-testid^="timeline-item-"]')
    .filter({ hasText: commentText })
    .first();
}

function getCommentActionsButton(page: Page, commentText: string) {
  const commentCard = getCommentCard(page, commentText);
  return commentCard.getByRole("button", { name: "Comment actions" });
}

test.describe.serial("Comment Edit and Delete", () => {
  let issueUrl: string;

  test.beforeAll(async () => {
    // Issue will be created by the first test
    // beforeAll just initializes the variable
  });

  test.afterAll(async ({ request }) => {
    // Cleanup all created issues
    if (createdIssueIds.size > 0) {
      await cleanupTestEntities(request, {
        issueIds: Array.from(createdIssueIds),
      });
      createdIssueIds.clear();
    }
  });

  test.describe("Author permissions", () => {
    const testCommentText = `Author test comment ${testId}`;
    const editedCommentText = `Edited comment ${testId}`;

    test("author can see edit and delete buttons on own comment", async ({
      page,
    }, testInfo) => {
      await loginAs(page, testInfo);

      // Create the test issue (first test in serial suite)
      if (!issueUrl) {
        issueUrl = await createTestIssue(page, testInfo);
        rememberIssueId(page);
      } else {
        await page.goto(issueUrl);
        await page.waitForLoadState("networkidle");
      }

      // Add a new comment
      await addComment(page, testCommentText);

      // Click the actions menu
      const actionsButton = getCommentActionsButton(page, testCommentText);
      await expect(actionsButton).toBeVisible();
      await actionsButton.click();

      // Verify both Edit and Delete options are visible
      await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
      await expect(
        page.getByRole("menuitem", { name: "Delete" })
      ).toBeVisible();

      // Close menu by pressing Escape
      await page.keyboard.press("Escape");
    });

    test("author can edit their own comment", async ({ page }, testInfo) => {
      await loginAs(page, testInfo);
      await page.goto(issueUrl);
      await page.waitForLoadState("networkidle");

      // Find the comment we created
      const actionsButton = getCommentActionsButton(page, testCommentText);
      await actionsButton.click();

      // Click Edit
      await page.getByRole("menuitem", { name: "Edit" }).click();

      // The textarea should appear with the comment content
      // Scope to the specific comment card to avoid matching the "Add Comment" textarea
      const commentCard = getCommentCard(page, testCommentText);
      const editTextarea = commentCard.locator("textarea[name='comment']");
      await expect(editTextarea).toBeVisible();

      // Clear and enter new content
      await editTextarea.clear();
      await editTextarea.fill(editedCommentText);

      // Save
      await page.getByRole("button", { name: "Save" }).click();

      // Wait for update
      await page.waitForLoadState("networkidle");

      // Verify the comment is updated
      await expect(page.getByText(editedCommentText)).toBeVisible();
      await expect(page.getByText(/\(edited .+ ago\)/)).toBeVisible();
    });

    test("author can delete their own comment", async ({ page }, testInfo) => {
      await loginAs(page, testInfo);
      await page.goto(issueUrl);
      await page.waitForLoadState("networkidle");

      // Find the edited comment
      const actionsButton = getCommentActionsButton(page, editedCommentText);
      await actionsButton.click();

      // Click Delete
      await page.getByRole("menuitem", { name: "Delete" }).click();

      // Confirmation dialog should appear
      await expect(
        page.getByRole("heading", { name: "Are you sure?" })
      ).toBeVisible();

      // Confirm deletion
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Delete" })
        .click();

      // Wait for deletion
      await page.waitForLoadState("networkidle");

      // Comment should be gone
      await expect(page.getByText(editedCommentText)).not.toBeVisible();
    });
  });

  test.describe("Admin permissions", () => {
    const memberComment = `Member comment for admin ${testId}`;

    test("member adds a comment", async ({ page }, testInfo) => {
      // Login as member
      await loginAs(page, testInfo, {
        email: TEST_USERS.member.email,
        password: TEST_USERS.member.password,
      });

      await page.goto(issueUrl);
      await page.waitForLoadState("networkidle");
      await addComment(page, memberComment);
    });

    test("admin can see delete but not edit on others comments", async ({
      page,
    }, testInfo) => {
      // Login as admin
      await loginAs(page, testInfo, {
        email: TEST_USERS.admin.email,
        password: TEST_USERS.admin.password,
      });

      await page.goto(issueUrl);
      await page.waitForLoadState("networkidle");

      // Find the member's comment
      const actionsButton = getCommentActionsButton(page, memberComment);
      await expect(actionsButton).toBeVisible();
      await actionsButton.click();

      // Admin should see Delete but NOT Edit (since it's not their comment)
      await expect(
        page.getByRole("menuitem", { name: "Delete" })
      ).toBeVisible();
      // Edit should not be visible
      await expect(
        page.getByRole("menuitem", { name: "Edit" })
      ).not.toBeVisible();

      await page.keyboard.press("Escape");
    });

    test("admin can delete others comments", async ({ page }, testInfo) => {
      // Login as admin
      await loginAs(page, testInfo, {
        email: TEST_USERS.admin.email,
        password: TEST_USERS.admin.password,
      });

      await page.goto(issueUrl);
      await page.waitForLoadState("networkidle");

      // Find the member's comment
      const actionsButton = getCommentActionsButton(page, memberComment);
      await actionsButton.click();

      // Click Delete
      await page.getByRole("menuitem", { name: "Delete" }).click();

      // Confirm deletion
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Delete" })
        .click();

      // Wait for deletion
      await page.waitForLoadState("networkidle");

      // Comment should be gone
      await expect(page.getByText(memberComment)).not.toBeVisible();
    });
  });

  test.describe("Non-author permissions", () => {
    const adminComment = `Admin comment ${testId}`;

    test("admin adds a comment", async ({ page }, testInfo) => {
      await loginAs(page, testInfo, {
        email: TEST_USERS.admin.email,
        password: TEST_USERS.admin.password,
      });

      await page.goto(issueUrl);
      await page.waitForLoadState("networkidle");
      await addComment(page, adminComment);
    });

    test("member cannot see actions on others comments", async ({
      page,
    }, testInfo) => {
      // Login as member
      await loginAs(page, testInfo, {
        email: TEST_USERS.member.email,
        password: TEST_USERS.member.password,
      });

      await page.goto(issueUrl);
      await page.waitForLoadState("networkidle");

      // Find the admin's comment
      const commentCard = getCommentCard(page, adminComment);
      await expect(commentCard).toBeVisible();

      // Actions button should NOT be visible (member can't edit/delete admin's comment)
      const actionsButton = commentCard.getByRole("button", {
        name: "Comment actions",
      });
      await expect(actionsButton).not.toBeVisible();
    });

    test("cleanup: admin deletes their comment", async ({ page }, testInfo) => {
      // Log back in as admin and delete the comment
      await loginAs(page, testInfo, {
        email: TEST_USERS.admin.email,
        password: TEST_USERS.admin.password,
      });
      await page.goto(issueUrl);
      await page.waitForLoadState("networkidle");

      const adminActionsButton = getCommentActionsButton(page, adminComment);
      await adminActionsButton.click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Delete" })
        .click();
      await page.waitForLoadState("networkidle");
    });
  });

  test("no actions shown on initial issue report", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo);
    await page.goto(issueUrl);
    await page.waitForLoadState("networkidle");

    // The initial issue report shows "Initial report" label
    const initialReport = page
      .locator('[data-testid^="timeline-item-"]')
      .filter({
        hasText: "Initial report",
      });

    await expect(initialReport).toBeVisible();

    // Should not have actions button even for the issue author
    const actionsButton = initialReport.getByRole("button", {
      name: "Comment actions",
    });
    await expect(actionsButton).not.toBeVisible();
  });
});
