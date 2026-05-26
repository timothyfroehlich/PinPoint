import { test, expect } from "@playwright/test";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupTestEntities } from "../support/cleanup.js";
import {
  fillReportForm,
  submitFormAndWaitForRedirect,
} from "../support/page-helpers.js";
import { loginAs, assertNoA11yViolations } from "../support/actions.js";
import { TEST_USERS } from "../support/constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IMAGE_UPLOAD_PREFIX = "E2E Image Upload";

test.describe("Image Upload Reporting", () => {
  test.afterEach(async ({ request }) => {
    await cleanupTestEntities(request, {
      issueTitlePrefix: IMAGE_UPLOAD_PREFIX,
    });
  });

  test("authenticated user should see uploaded image on issue page", async ({
    page,
  }, testInfo) => {
    // 1. Login — use loginAs helper for proper auth-cookie settling (networkidle + reload)
    await loginAs(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    // 2. Go to Report
    await page.goto("/report");
    const select = page.getByTestId("machine-select");
    // Ensure we pick the same machine as the dashboard default or just pick the first one
    await select.selectOption({ index: 1 });
    await expect(page).toHaveURL(/machine=/);

    await assertNoA11yViolations(page);

    // 3. Fill Form
    const issueTitle = `${IMAGE_UPLOAD_PREFIX} Auth ${Date.now()}`;
    await fillReportForm(page, {
      title: issueTitle,
      description: "Testing image persistence for auth user.",
      includePriority: true, // Auth users see priority
    });

    // 4. Upload Image
    const testImagePath = join(__dirname, "..", "fixtures", "test-image.png");
    await page.setInputFiles(
      'input[data-testid="image-upload-input"]',
      testImagePath
    );

    // Verify preview
    await expect(
      page.getByRole("img", { name: "test-image.png" })
    ).toBeVisible();
    // Wait for the upload validation/compression/upload cycle to finish (preview visibility confirms this usually,
    // but the actual upload request happens in background or before preview?
    // ImageUploadButton: 1. Validate, 2. Compress, 3. Upload, 4. Show success toast & call onUploadComplete
    // We should wait for the toast or the image to appear.
    await expect(page.getByText("Image uploaded successfully")).toBeVisible();

    // 5. Submit — use the redirect helper so Mobile Chrome / WebKit don't
    // race on Server-Action navigation (PP-7nb pattern).
    await submitFormAndWaitForRedirect(
      page,
      page.getByRole("button", { name: "Submit Issue Report" }),
      { awayFrom: "/report" }
    );

    // 6. Verify Redirection to Issue Detail
    await expect(page).toHaveURL(/\/i\/\d+/);

    // 7. Verify image appears inline in the timeline, not in a separate images panel
    await expect(page.getByText("Images (1)")).toHaveCount(0);
    await expect(page.getByTestId("issue-timeline")).toBeVisible();

    // The image itself appears in the initial report card inside the timeline
    const image = page.getByRole("img", { name: "test-image.png" }).first();
    await expect(image).toBeVisible();

    // Wait for hydration before clicking — the helper completes navigation on
    // domcontentloaded, but the timeline image's click handler is bound by
    // React during hydration. On Mobile Chrome the click could fire before
    // hydration and silently no-op, leaving the lightbox unopened.
    await page
      .waitForLoadState("networkidle", { timeout: 5000 })
      .catch(() => undefined);

    // Optional: Click to open lightbox
    await image.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("img", { name: "test-image.png" })
        .first()
    ).toBeVisible();
  });
});
