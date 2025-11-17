import { test, expect } from "@playwright/test";

test.describe("Issues CRUD", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto("/login");

    // Login as test user (assumes test user exists from seed data)
    await page.fill('input[name="email"]', "member@test.com");
    await page.fill('input[name="password"]', "password");
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL("/dashboard");
  });

  test("should create a new issue from issues page", async ({ page }) => {
    // Navigate to issues page
    await page.goto("/issues");

    // Click "Report Issue" button
    await page.click('a[href="/issues/new"]');

    // Should be on issue creation page
    await expect(page).toHaveURL("/issues/new");
    await expect(page.locator("h1")).toContainText("Report Issue");

    // Fill out the form
    await page.click('button[id="machineId"]'); // Open machine dropdown
    await page.click('div[role="option"]:first-child'); // Select first machine

    await page.fill('input[name="title"]', "Test issue from E2E");
    await page.fill(
      'textarea[name="description"]',
      "This is a test issue created from E2E tests"
    );

    await page.click('button[id="severity"]'); // Open severity dropdown
    await page.click('div[role="option"][data-value="playable"]'); // Select "Playable"

    // Submit the form
    await page.click('button[type="submit"]');

    // Should redirect to issue detail page
    await page.waitForURL(/\/issues\/[a-f0-9-]+$/);
    await expect(page.locator("h1")).toContainText("Test issue from E2E");
    await expect(page.locator("main")).toContainText(
      "This is a test issue created from E2E tests"
    );

    // Should show correct initial status and severity
    await expect(
      page.locator('[data-testid="badge"]', { hasText: "New" })
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="badge"]', { hasText: "Playable" })
    ).toBeVisible();
  });

  test("should create issue from machine detail page with pre-filled machine", async ({
    page,
  }) => {
    // First, create a machine
    await page.goto("/machines/new");
    await page.fill('input[name="name"]', "E2E Test Machine");
    await page.click('button[type="submit"]');

    // Wait for redirect to machine detail page
    await page.waitForURL(/\/machines\/[a-f0-9-]+$/);
    const machineUrl = page.url();
    const machineId = machineUrl.split("/").pop();

    // Click "Report Issue" button
    await page.click('button:has-text("Report Issue")');

    // Should navigate to issue creation page with machineId query param
    await expect(page).toHaveURL(`/issues/new?machineId=${machineId}`);

    // Machine dropdown should be pre-selected
    await expect(page.locator('button[id="machineId"]')).toContainText(
      "E2E Test Machine"
    );

    // Fill out the rest of the form
    await page.fill('input[name="title"]', "Pre-filled machine test");
    await page.click('button[id="severity"]');
    await page.click('div[role="option"][data-value="minor"]');

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to issue detail
    await page.waitForURL(/\/issues\/[a-f0-9-]+$/);
    await expect(page.locator("h1")).toContainText("Pre-filled machine test");
    await expect(page.locator("main")).toContainText("E2E Test Machine");
  });

  test("should update issue status and create timeline event", async ({
    page,
  }) => {
    // Create an issue first
    await page.goto("/issues/new");

    await page.click('button[id="machineId"]');
    await page.click('div[role="option"]:first-child');
    await page.fill('input[name="title"]', "Status update test");
    await page.click('button[id="severity"]');
    await page.click('div[role="option"][data-value="unplayable"]');
    await page.click('button[type="submit"]');

    // Wait for issue detail page
    await page.waitForURL(/\/issues\/[a-f0-9-]+$/);

    // Initial status should be "New"
    await expect(page.locator('select[id="status"]')).toHaveValue("new");

    // Change status to "In Progress"
    await page.click('button[id="status"]');
    await page.click('div[role="option"][data-value="in_progress"]');

    // Wait for page reload (Server Action redirect)
    await page.waitForLoadState("networkidle");

    // Status should be updated
    await expect(page.locator('select[id="status"]')).toHaveValue(
      "in_progress"
    );

    // Timeline should show status change event
    await expect(page.locator("main")).toContainText(
      "Status changed from New to In Progress"
    );
  });

  test("should update issue severity and create timeline event", async ({
    page,
  }) => {
    // Create an issue first
    await page.goto("/issues/new");

    await page.click('button[id="machineId"]');
    await page.click('div[role="option"]:first-child');
    await page.fill('input[name="title"]', "Severity update test");
    await page.click('button[id="severity"]');
    await page.click('div[role="option"][data-value="minor"]');
    await page.click('button[type="submit"]');

    // Wait for issue detail page
    await page.waitForURL(/\/issues\/[a-f0-9-]+$/);

    // Initial severity should be "Minor"
    await expect(page.locator('select[id="severity"]')).toHaveValue("minor");

    // Change severity to "Unplayable"
    await page.click('button[id="severity"]');
    await page.click('div[role="option"][data-value="unplayable"]');

    // Wait for page reload
    await page.waitForLoadState("networkidle");

    // Severity should be updated
    await expect(page.locator('select[id="severity"]')).toHaveValue(
      "unplayable"
    );

    // Timeline should show severity change event
    await expect(page.locator("main")).toContainText(
      "Severity changed from Minor to Unplayable"
    );
  });

  test("should assign issue to user and create timeline event", async ({
    page,
  }) => {
    // Create an issue first
    await page.goto("/issues/new");

    await page.click('button[id="machineId"]');
    await page.click('div[role="option"]:first-child');
    await page.fill('input[name="title"]', "Assignment test");
    await page.click('button[id="severity"]');
    await page.click('div[role="option"][data-value="playable"]');
    await page.click('button[type="submit"]');

    // Wait for issue detail page
    await page.waitForURL(/\/issues\/[a-f0-9-]+$/);

    // Initial assignee should be "Unassigned"
    await expect(page.locator('select[id="assignee"]')).toHaveValue(
      "unassigned"
    );

    // Assign to a user (select first user in dropdown, skipping "Unassigned")
    await page.click('button[id="assignee"]');
    await page.click('div[role="option"]:not([data-value="unassigned"]):first');

    // Wait for page reload
    await page.waitForLoadState("networkidle");

    // Assignee should be updated (not "Unassigned")
    const assigneeValue = await page
      .locator('select[id="assignee"]')
      .inputValue();
    expect(assigneeValue).not.toBe("unassigned");

    // Timeline should show assignment event
    await expect(page.locator("main")).toContainText("Assigned to");
  });

  test("should display issues in issues list page", async ({ page }) => {
    // Create an issue first
    await page.goto("/issues/new");

    await page.click('button[id="machineId"]');
    await page.click('div[role="option"]:first-child');
    await page.fill('input[name="title"]', "List display test");
    await page.click('button[id="severity"]');
    await page.click('div[role="option"][data-value="playable"]');
    await page.click('button[type="submit"]');

    // Navigate to issues list
    await page.goto("/issues");

    // Should see the issue in the list
    await expect(page.locator('[data-testid="issue-card"]')).toContainText(
      "List display test"
    );

    // Click on the issue card to view details
    await page.click(
      'a[data-testid="issue-card"]:has-text("List display test")'
    );

    // Should navigate to issue detail page
    await page.waitForURL(/\/issues\/[a-f0-9-]+$/);
    await expect(page.locator("h1")).toContainText("List display test");
  });

  test("should display issues on machine detail page", async ({ page }) => {
    // Create a machine
    await page.goto("/machines/new");
    await page.fill('input[name="name"]', "Machine with issues");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/machines\/[a-f0-9-]+$/);
    const machineUrl = page.url();

    // Create an issue for this machine
    await page.click('button:has-text("Report Issue")');
    await page.fill('input[name="title"]', "Machine-specific issue");
    await page.click('button[id="severity"]');
    await page.click('div[role="option"][data-value="unplayable"]');
    await page.click('button[type="submit"]');

    // Navigate back to machine detail page
    await page.goto(machineUrl);

    // Should see the issue listed
    await expect(page.locator('[data-testid="issue-card"]')).toContainText(
      "Machine-specific issue"
    );

    // Machine status should reflect the unplayable issue
    await expect(
      page.locator('[data-testid="machine-status-badge"]')
    ).toContainText("Unplayable");
  });
});
