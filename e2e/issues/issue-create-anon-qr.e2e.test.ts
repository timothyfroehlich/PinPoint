/**
 * E2E – Anonymous Issue Creation via QR
 *
 * Validates the guest reporting journey end-to-end:
 * 1) QR endpoint resolves to the correct machine report URL.
 * 2) Anonymous user can submit the report form.
 * 3) Resulting issue remains inaccessible to guests (no edit/attachment access).
 *
 * Tests run in guest projects only; any admin setup happens via API requests
 * that use proper authenticated endpoints (no direct DB access).
 *
 * State Management:
 * - Captures original state before modifications
 * - Restores state after all tests complete
 * - Ensures test isolation and prevents side effects
 */

import { test, expect, request as playwrightRequest } from "@playwright/test";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import {
  captureTestState,
  restoreTestState,
  enableAnonymousReporting,
  ensureQRCode,
  waitForIssueCreation,
} from "../helpers/test-setup-helpers";
import type { APIRequestContext } from "@playwright/test";

const MACHINE_ID = SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1;
const ORGANIZATION_ID = SEED_TEST_IDS.ORGANIZATIONS.primary;
const STATUS_ID = SEED_TEST_IDS.STATUSES.NEW_PRIMARY;
const PRIORITY_ID = SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY;
const MACHINE_DISPLAY_NAME =
  "Ultraman: Kaiju Rumble (Blood Sucker Edition) #1";

test.use({ storageState: undefined });

test.describe("Issue Create – Anonymous via QR (E2E)", () => {
  let qrCodeId: string;
  let requestContext: APIRequestContext;
  let originalState: Awaited<ReturnType<typeof captureTestState>>;

  test.beforeAll(async () => {
    // Create API request context for setup
    const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
    requestContext = await playwrightRequest.newContext({ baseURL });

    // Capture original state for restoration
    originalState = await captureTestState(
      requestContext,
      MACHINE_ID,
      ORGANIZATION_ID,
      STATUS_ID,
      PRIORITY_ID,
    );

    // Enable anonymous reporting with proper API calls
    await enableAnonymousReporting(
      requestContext,
      MACHINE_ID,
      ORGANIZATION_ID,
      STATUS_ID,
      PRIORITY_ID,
    );

    // Ensure QR code exists
    qrCodeId = await ensureQRCode(requestContext, MACHINE_ID);
  });

  test.afterAll(async () => {
    // Restore original state
    if (originalState) {
      await restoreTestState(
        requestContext,
        MACHINE_ID,
        ORGANIZATION_ID,
        originalState,
      );
    }

    // Clean up request context
    await requestContext.dispose();
  });

  test.beforeEach(({ }, testInfo) => {
    if (testInfo.project.name.includes("auth")) {
      test.skip("Anonymous QR flow runs only on guest browsers");
    }
  });

  test("QR endpoint redirects to the machine report form", async ({ page }) => {
    const response = await page.request.fetch(`/api/qr/${qrCodeId}`, {
      maxRedirects: 0,
    });

    expect(response.status(), "QR endpoint should redirect").toBe(307);

    const headers = response.headers();
    const locationHeader = headers.location ?? headers.Location;

    expect(locationHeader).toBeTruthy();
    expect(locationHeader).toContain(
      `/machines/${MACHINE_ID}/report-issue`,
    );
  });

  test("anonymous user can submit the report form but cannot view the new issue", async ({
    page,
  }) => {
    await page.goto(`/machines/${MACHINE_ID}/report-issue`);

    await expect(
      page.getByRole("heading", { name: "Report an Issue" }),
    ).toBeVisible();
    await expect(
      page.locator("text=You're reporting a problem with"),
    ).toContainText(MACHINE_DISPLAY_NAME);
    await expect(page.getByTestId("machine-id-hidden")).toHaveValue(MACHINE_ID);

    const title = `Anon QR issue ${Date.now()}`;
    await page.getByTestId("issue-title-input").fill(title);
    await page
      .getByTestId("issue-description-input")
      .fill("Scanned QR code to report intermittent power cycling.");
    await page
      .getByTestId("reporter-email-input")
      .fill(`qr-reporter+${Date.now()}@example.com`);

    await page.getByTestId("create-issue-submit").click();

    // Use API-based issue polling instead of direct DB query
    const createdIssueId = await waitForIssueCreation(requestContext, title);

    await page.goto(`/issues/${createdIssueId}`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Issue Access Required" }),
    ).toBeVisible();
  });
});
