// e2e/smoke/rich-text.spec.ts
import { test, expect } from "@playwright/test";
import { loginAs, logout } from "../support/actions";
import { createTestUser, createTestMachine } from "../support/supabase-admin";
import { getTestPrefix } from "../support/test-isolation";

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
    // 1. Setup users — unique prefix per test run to avoid DB conflicts in parallel
    const prefix = getTestPrefix();
    const reporterEmail = `reporter-${prefix}@example.com`;
    const mentionedEmail = `mentioned-${prefix}@example.com`;

    // Unique display names prevent mention autocomplete from matching other parallel test users
    const reporter = await createTestUser(reporterEmail, undefined, {
      firstName: `Reporter${prefix}`,
      lastName: "RT",
    });
    // Give the mentioned user a distinct name so autocomplete can target them unambiguously
    await createTestUser(mentionedEmail, undefined, {
      firstName: `Mention${prefix}`,
      lastName: "Person",
    });

    // 2. Login as reporter
    await loginAs(page, testInfo, { email: reporterEmail });

    // 3. Create machine with unique initials to avoid DB unique constraint collisions
    const initials = `T${prefix.slice(-2).toUpperCase()}`;
    const machine = await createTestMachine(reporter.id, initials);

    // 4. Go to report page
    await page.goto(`/report?machine=${machine.initials}`);

    // 5. Fill title
    await page.fill('input[name="title"]', "Test Rich Text Issue");

    // 6. Use Rich Text Editor
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type("Hello ");

    // 7. Trigger mention — type unique prefix so autocomplete unambiguously targets this test's user
    const mentionedDisplayName = `Mention${prefix} Person`;
    await page.keyboard.type(`@Mention${prefix}`);

    // Wait for autocomplete and select the specific user
    const mentionItem = page
      .locator(`button:has-text("${mentionedDisplayName}")`)
      .first();
    await expect(mentionItem).toBeVisible();
    await page.keyboard.press("Enter");

    // Verify mention is in the editor
    await expect(editor).toContainText(`@${mentionedDisplayName}`);

    // 8. Add some formatting via toolbar (cross-platform select-all)
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.click('button[aria-label="Toggle bold"]');

    // 9. Submit issue
    await page.click('button[type="submit"]');

    // 10. Verify on issue page
    await expect(page).toHaveURL(new RegExp(`/m/${machine.initials}/i/1`));
    await expect(page.locator("h1")).toContainText("Test Rich Text Issue");

    // 11. Verify rich text rendering
    const description = page.locator(".prose");
    await expect(description.locator("strong").first()).toBeVisible();
    await expect(description.locator(".mention")).toContainText(
      `@${mentionedDisplayName}`
    );

    // 12. Check notification for mentioned user via the Bell dropdown
    await logout(page, testInfo);
    await loginAs(page, testInfo, { email: mentionedEmail });

    // Open notification bell dropdown
    await page
      .getByRole("button", { name: /notifications/i })
      .first()
      .click();
    await expect(
      page.getByText(`Mentioned in ${machine.initials}-1`)
    ).toBeVisible();
  });

  test("allows adding comments with rich text", async ({ page }, testInfo) => {
    const prefix = getTestPrefix();
    const userEmail = `user-${prefix}@example.com`;
    const user = await createTestUser(userEmail, undefined, {
      firstName: `User${prefix}`,
      lastName: "RT",
    });

    // Unique initials to avoid collisions
    const initials = `C${prefix.slice(-2).toUpperCase()}`;
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
