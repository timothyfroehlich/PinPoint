import { test, expect } from "@playwright/test";

test.describe("Issue Reporter Name", () => {
  test("new user details should appear on reported issue", async ({ page }) => {
    // 1. Sign up a new user
    const timestamp = Date.now();
    const email = `reporter-${timestamp}@example.com`;
    const firstName = "Test";
    const lastName = "Reporter";

    await page.goto("/signup");
    await page.getByLabel("First Name").fill(firstName);
    await page.getByLabel("Last Name").fill(lastName);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Create Account" }).click();

    // Verify dashboard access (confirms login)
    await expect(page).toHaveURL("/dashboard");

    // 2. Report a new issue
    // We need a machine to report on. Assuming 'ATOMIC' exists or picking one from the list if possible.
    // For smoke tests, usually machines exist. Let's try to go to a machine page.
    // Better: Go to the machine list and pick the first one.
    await page.goto("/m");
    const machineCard = page.getByTestId("machine-card").first();
    // Click the machine to view details
    // Click the machine to view details (the card itself is the link)
    await machineCard.click();

    // Click "Report Issue"
    await page.getByTestId("machine-report-issue").click();

    // Fill issue form
    const issueTitle = `Bug Report from ${firstName}`;
    await page.getByLabel("Title").fill(issueTitle);
    await page.getByLabel("Severity").selectOption({ value: "minor" });
    // Assuming Playable/Minor/Unplayable are options.
    // Let's check the select options values/labels if this fails, but 'Minor' is standard.
    await page.getByLabel("Priority").selectOption({ value: "low" });

    await page.getByRole("button", { name: "Report Issue" }).click();

    // 3. Verify Reporter Name on Issue Detail
    // Should redirect to the issue.
    await expect(page.getByRole("heading", { name: issueTitle })).toBeVisible();

    // Check sidebar or metadata for reporter name
    // Found in IssueSidebar.tsx: "Reporter" label
    await expect(page.getByText("Reporter", { exact: true })).toBeVisible();
    await expect(page.getByText(`${firstName} ${lastName}`)).toBeVisible();

    // Check it's NOT Unknown
    await expect(page.getByText("Unknown user")).not.toBeVisible();
    await expect(page.getByText("Unknown")).not.toBeVisible();
  });
});
