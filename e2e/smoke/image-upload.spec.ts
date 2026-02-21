import { test, expect } from "@playwright/test";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupTestEntities } from "../support/cleanup.js";
import { fillReportForm } from "../support/page-helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IMAGE_UPLOAD_PREFIX = "E2E Image Upload";

test.describe("Image Upload Reporting", () => {
  test.afterEach(async ({ request }) => {
    await cleanupTestEntities(request, {
      issueTitlePrefix: IMAGE_UPLOAD_PREFIX,
    });
  });

  test("should upload image and persist it to issue", async ({ page }) => {
    // 1. Prepare
    await page.goto("/report");
    const select = page.getByTestId("machine-select");
    await select.selectOption({ index: 1 });
    await expect(page).toHaveURL(/machine=/);

    // 2. Fill Form
    const issueTitle = `${IMAGE_UPLOAD_PREFIX} ${Date.now()}`;
    await fillReportForm(page, {
      title: issueTitle,
      description: "Testing image persistence.",
      includePriority: false,
    });

    // 3. Upload Image
    // Use a test PNG from fixtures (2.3KB) that meets the 1KB minimum validation requirement
    const testImagePath = join(__dirname, "..", "fixtures", "test-image.png");

    await page.setInputFiles(
      'input[data-testid="image-upload-input"]',
      testImagePath
    );

    // 4. Verify Preview appears
    // The preview card has a generic "Issue image" alt text or the filename
    // Verify preview
    await expect(page.getByText("Image uploaded successfully")).toBeVisible();
    await expect(
      page.getByRole("img", { name: "test-image.png" })
    ).toBeVisible();

    // 5. Submit
    await page.getByRole("button", { name: "Submit Issue Report" }).click();

    // 6. Verify Success & Navigation
    // Anonymous user goes to success page, then we can click the link to view the issue if we were logged in,
    // but here we are anonymous. The success page doesn't link to the issue for anonymous users for privacy/security
    // (unless we change that flow, but currently it doesn't).

    // Wait, the action redirects:
    // "Redirect logic: 2. Anonymous users go to success page"
    await expect(page).toHaveURL("/report/success");

    // To verify persistence, we need to login as an admin or verify via DB/API.
    // Or we can modify the test to login first.
    // Let's login first to get redirected to the issue page directly.
  });

  test("authenticated user should see uploaded image on issue page", async ({
    page,
  }) => {
    // 1. Login
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@test.com");
    await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/dashboard");

    // 2. Go to Report
    await page.goto("/report");
    const select = page.getByTestId("machine-select");
    // Ensure we pick the same machine as the dashboard default or just pick the first one
    await select.selectOption({ index: 1 });
    await expect(page).toHaveURL(/machine=/);

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

    // 5. Submit
    await page.getByRole("button", { name: "Submit Issue Report" }).click();

    // 6. Verify Redirection to Issue Detail
    await expect(page).toHaveURL(/\/i\/\d+/);

    // 7. Verify Image on Detail Page
    // "Images (1)" header
    await expect(page.getByText("Images (1)")).toBeVisible();

    // The image itself in the gallery (might also be in timeline, so use first())
    const image = page.getByRole("img", { name: "test-image.png" }).first();
    await expect(image).toBeVisible();

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
