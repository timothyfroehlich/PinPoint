// e2e/smoke/rich-text.spec.ts
import { test, expect } from "@playwright/test";
import { loginAs, logout } from "../support/actions";
import { createTestUser, createTestMachine } from "../support/supabase-admin";

/**
 * E2E tests for Rich Text Editor and @Mentions
 *
 * Verifies:
 * 1. Editor loads and allows text entry
 * 2. Mention autocomplete triggers and works
 * 3. Rich text is rendered correctly
 * 4. Notifications are created for mentions
 */

test.describe("Rich Text and Mentions", () => {
  test("allows creating an issue with rich text and mentions", async ({
    page,
  }, testInfo) => {
    // 1. Setup users — unique timestamp per test run to avoid DB conflicts
    const timestamp = Date.now();
    const reporterEmail = `reporter-${timestamp}@example.com`;
    const mentionedEmail = `mentioned-${timestamp}@example.com`;

    const reporter = await createTestUser(reporterEmail);
    const _mentioned = await createTestUser(mentionedEmail);

    // 2. Login as reporter
    await loginAs(page, testInfo, { email: reporterEmail });

    // 3. Create machine with unique initials to avoid DB unique constraint collisions
    const initials = `T${String(timestamp).slice(-2)}`;
    const machine = await createTestMachine(reporter.id, initials);

    // 4. Go to report page
    await page.goto(`/report?machine=${machine.initials}`);

    // 5. Fill title
    await page.fill('input[name="title"]', "Test Rich Text Issue");

    // 6. Use Rich Text Editor
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type("Hello ");

    // 7. Trigger mention — type @Test to trigger autocomplete
    await page.keyboard.type("@Test");

    // Wait for autocomplete and select first match
    const mentionItem = page.locator('button:has-text("Test User")').first();
    await expect(mentionItem).toBeVisible();
    await page.keyboard.press("Enter");

    // Verify mention is in the editor
    await expect(editor).toContainText("@Test User");

    // 8. Add some formatting via toolbar (cross-platform select-all)
    await page.keyboard.press("ControlOrMeta+a");
    await page.click('button[aria-label="Toggle bold"]');

    // 9. Submit issue
    await page.click('button[type="submit"]');

    // 10. Verify on issue page
    await expect(page).toHaveURL(new RegExp(`/m/${machine.initials}/i/1`));
    await expect(page.locator("h1")).toContainText("Test Rich Text Issue");

    // 11. Verify rich text rendering
    const description = page.locator(".prose");
    await expect(description.locator("strong")).toBeVisible();
    await expect(description.locator(".mention")).toContainText("@Test User");

    // 12. Check notification for mentioned user via the Bell dropdown
    await logout(page);
    await loginAs(page, testInfo, { email: mentionedEmail });

    // Open notification bell dropdown
    await page
      .getByRole("button", { name: /notifications/i })
      .first()
      .click();
    await expect(
      page.getByText(`Mentioned in ${machine.initials}-01`)
    ).toBeVisible();
  });

  test("allows adding comments with rich text", async ({ page }, testInfo) => {
    const timestamp = Date.now();
    const userEmail = `user-${timestamp}@example.com`;
    const user = await createTestUser(userEmail);

    // Unique initials to avoid collisions
    const initials = `C${String(timestamp).slice(-2)}`;
    const machine = await createTestMachine(user.id, initials);

    await loginAs(page, testInfo, { email: userEmail });
    await page.goto(`/report?machine=${machine.initials}`);
    await page.fill('input[name="title"]', "Issue for comment");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(new RegExp(`/m/${machine.initials}/i/1`));

    // Add rich text comment
    const editor = page.locator(".ProseMirror").last();
    await editor.click();
    await page.keyboard.type("This is a ");

    // Test toolbar button (Commandment #11)
    await page.click('button[aria-label="Toggle italic"]');
    await page.keyboard.type("rich text");
    await page.click('button[aria-label="Toggle italic"]');
    await page.keyboard.type(" comment.");

    await page.click('button:has-text("Add Comment")');

    // Verify rendered comment
    const lastComment = page.locator(".prose").last();
    await expect(lastComment.locator("em")).toContainText("rich text");
  });
});
