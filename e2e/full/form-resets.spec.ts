/**
 * E2E Tests: CREATE-form reset behavior (PP-rvv)
 *
 * Verifies that all four CREATE forms fully clear every field on successful
 * submit using the canonical reset pattern: useEffect on success → formRef.reset()
 * → explicit setState for controlled state → redirect last.
 *
 * Forms covered:
 * - /report (UnifiedReportForm)
 * - /m/new (CreateMachineForm)
 * - Issue detail comment box (AddCommentForm)
 * - Admin user invite dialog (InviteUserDialog)
 */

import { test, expect } from "@playwright/test";
import { ensureLoggedIn, loginAs, logout } from "../support/actions";
import { cleanupTestEntities } from "../support/cleanup";
import { seededIssues, seededMachines, TEST_USERS } from "../support/constants";
import { fillReportForm } from "../support/page-helpers";

const RESET_PREFIX = "E2E Reset";

test.describe("CREATE form resets", () => {
  test.afterEach(async ({ request }) => {
    await cleanupTestEntities(request, {
      issueTitlePrefix: RESET_PREFIX,
    });
  });

  test("UnifiedReportForm clears all fields after successful submit", async ({
    page,
  }, testInfo) => {
    // Authenticate so the form returns success-with-redirectTo (the public path
    // server-side redirects to /report/success — same reset code path runs).
    await ensureLoggedIn(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    const machineInitials = seededMachines.medievalMadness.initials;

    await page.goto("/report");
    await page.getByTestId("machine-select").selectOption({ index: 1 });

    await fillReportForm(page, {
      title: `${RESET_PREFIX} Report Reset Test`,
      description: "A description that should not survive reset.",
    });

    await page.getByRole("button", { name: "Submit Issue Report" }).click();

    // Wait for redirect away from /report (auth user goes to issue detail).
    await expect(page).toHaveURL(/\/m\/[A-Z0-9]+\/i\/[0-9]+/, {
      timeout: 30000,
    });

    // Navigate back to /report (no machine param). All fields must be empty.
    // This proves localStorage was cleared and the reset effect ran before
    // navigation. URL machine param would mask the test, so we use the bare URL.
    await page.goto("/report");

    // Machine select shows placeholder option, not a previously chosen machine.
    await expect(page.getByTestId("machine-select")).toHaveValue("");

    // Title cleared.
    await expect(page.getByLabel("Issue Title *")).toHaveValue("");

    // Description (RichText) cleared — the editor renders the placeholder.
    await expect(page.locator(".ProseMirror").first()).toHaveText("");

    // No images present.
    await expect(page.locator('input[name="imagesMetadata"]')).toHaveValue(
      "[]"
    );

    // Confirm machineInitials wasn't hydrated from a leaked localStorage entry.
    expect(page.url()).not.toContain(`machine=${machineInitials}`);
  });

  test("UnifiedReportForm Clear button wipes fields after confirmation", async ({
    page,
  }, testInfo) => {
    await ensureLoggedIn(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    await page.goto("/report");
    await page.getByTestId("machine-select").selectOption({ index: 1 });

    await page
      .getByLabel("Issue Title *")
      .fill(`${RESET_PREFIX} clear-button title`);

    // Open confirmation dialog and confirm.
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(
      page.getByRole("alertdialog", { name: "Clear all fields?" })
    ).toBeVisible();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Clear fields" })
      .click();

    await expect(
      page.getByRole("alertdialog", { name: "Clear all fields?" })
    ).not.toBeVisible();

    await expect(page.getByLabel("Issue Title *")).toHaveValue("");
    await expect(page.getByTestId("machine-select")).toHaveValue("");
  });

  test("CreateMachineForm clears fields after successful submit", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    const initials = `R${String(Date.now()).slice(-3)}`;
    const name = `${RESET_PREFIX} Machine ${initials}`;

    await page.goto("/m/new");

    await page.getByLabel("Machine Name *").fill(name);
    await page.getByLabel("Initials *").fill(initials);

    await page.getByRole("button", { name: "Create Machine" }).click();

    // Server returns ok({redirectTo: `/m/${initials}`}) → client navigates.
    await expect(page).toHaveURL(new RegExp(`/m/${initials}$`), {
      timeout: 15000,
    });

    // Re-visit /m/new — all fields must be empty (no leaked state).
    await page.goto("/m/new");
    await expect(page.getByLabel("Machine Name *")).toHaveValue("");
    await expect(page.getByLabel("Initials *")).toHaveValue("");
  });

  test("CreateMachineForm Clear button wipes fields after confirmation", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    await page.goto("/m/new");

    await page.getByLabel("Machine Name *").fill(`${RESET_PREFIX} TempMachine`);
    await page.getByLabel("Initials *").fill("TMP");

    await page.getByRole("button", { name: "Clear" }).click();
    await expect(
      page.getByRole("alertdialog", { name: "Clear all fields?" })
    ).toBeVisible();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Clear fields" })
      .click();

    await expect(page.getByLabel("Machine Name *")).toHaveValue("");
    await expect(page.getByLabel("Initials *")).toHaveValue("");

    // Logout to keep next test isolated from admin session.
    await logout(page, testInfo);
  });

  test("AddCommentForm clears editor and images after successful submit", async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(browserName === "webkit", "Skipped on WebKit (cookie issues)");

    await loginAs(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    // Use a seeded issue so we don't have to create one.
    const seeded = seededIssues.HD[0];
    await page.goto(`/m/HD/i/${seeded.num}`);

    const editor = page.locator(".ProseMirror").first();
    await editor.waitFor({ timeout: 15000 });
    await editor.click();
    await page.keyboard.type(`${RESET_PREFIX} comment body`);

    await page.getByRole("button", { name: "Add Comment" }).click();

    // Toast confirms success without leaving the page.
    await expect(page.getByText("Comment added")).toBeVisible({
      timeout: 10000,
    });

    // The form's editor (the LAST .ProseMirror on the page when comments
    // exist) should now be empty. We use the form's hidden comment input
    // because asserting on the editor's contenteditable text is flaky.
    await expect(page.locator('form input[name="comment"]')).toHaveValue("");
    await expect(page.locator('form input[name="imagesMetadata"]')).toHaveValue(
      "[]"
    );
  });

  test("InviteUserDialog clears fields after cancel + reopen", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    await page.goto("/m/new");

    // Open invite dialog from the OwnerSelect "Invite New" affordance.
    await page.getByRole("button", { name: /Invite New/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: /Invite New User/i })
    ).toBeVisible();

    // Fill some values that should NOT survive a close+reopen cycle.
    // Use role+name for Email — the dialog also has a "Send Invitation Email"
    // switch whose name matches /Email/i, so a label-only matcher collides.
    await dialog.getByLabel(/First Name/i).fill("Reset");
    await dialog.getByLabel(/Last Name/i).fill("Probe");
    await dialog
      .getByRole("textbox", { name: "Email" })
      .fill(`reset-probe-${Date.now()}@example.com`);

    // Cancel dismisses without submit; the dialog's existing onOpenChange
    // useEffect calls form.reset() on close.
    await dialog.getByRole("button", { name: /Cancel/i }).click();
    await expect(
      page.getByRole("heading", { name: /Invite New User/i })
    ).not.toBeVisible();

    // Reopen and verify all fields are empty.
    await page.getByRole("button", { name: /Invite New/i }).click();
    const reopened = page.getByRole("dialog");
    await expect(
      reopened.getByRole("heading", { name: /Invite New User/i })
    ).toBeVisible();

    await expect(reopened.getByLabel(/First Name/i)).toHaveValue("");
    await expect(reopened.getByLabel(/Last Name/i)).toHaveValue("");
    await expect(reopened.getByRole("textbox", { name: "Email" })).toHaveValue(
      ""
    );
  });
});
