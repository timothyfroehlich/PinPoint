import { test, expect } from "@playwright/test";
// import { faker } from "@faker-js/faker";

async function registerUser(page: any) {
  const timestamp = Date.now();
  const firstName = `Test`;
  const lastName = `User${timestamp}`;
  const email = `user${timestamp}@example.com`;
  const password = "TestPassword123!";

  await page.goto("/signup");
  await page.getByLabel("First Name").fill(firstName);
  await page.getByLabel("Last Name").fill(lastName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL("/dashboard");

  return { firstName, lastName, email, password };
}

test.describe("Public Report Form (Auth)", () => {
  test("logged in user reporting via public form should be identified", async ({
    page,
  }) => {
    // 1. Sign up a new user
    const { firstName, lastName } = await registerUser(page);

    // 2. Navigate to Public Report Page
    await page.goto("/report");

    // 3. Fill out public form
    // Select first machine
    await page.getByTestId("machine-select").selectOption({ index: 1 });

    const issueTitle = `Public Repro from ${firstName}`;
    await page.getByLabel("Issue Title").fill(issueTitle);
    await page
      .getByLabel("Description")
      .fill("Testing public form while logged in");
    await page.getByLabel("Severity").selectOption({ value: "minor" });

    await page.getByRole("button", { name: "Submit Issue Report" }).click();

    // 4. Verify Success
    await expect(
      page.getByRole("heading", { name: "Issue Sent!" })
    ).toBeVisible();

    // 5. Navigate to the issue to check reporter
    // We assume the success page or a list allows us to find it.
    // For now, let's go to the machines list, pick the machine, and find the issue.
    // Or easier: Go to Dashboard, check "Recently Reported Issues"
    await page.goto("/dashboard");

    // Find the issue in the list
    const issueRow = page
      .getByRole("row")
      .filter({ hasText: issueTitle })
      .first();
    await expect(issueRow).toBeVisible();

    // Check reporter name in the row
    // Use strict check to ensure it is NOT "Unknown" or "Anonymous"
    await expect(issueRow.getByText(`${firstName} ${lastName}`)).toBeVisible();
    await expect(issueRow.getByText("Unknown")).not.toBeVisible();
    await expect(issueRow.getByText("Anonymous")).not.toBeVisible();
  });
});
