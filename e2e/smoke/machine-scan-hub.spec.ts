import { expect, test } from "../support/fixtures.js";
import { seededMachines } from "../support/constants.js";

test("apron scan opens Quick report with AFM and source preserved", async ({
  page,
}) => {
  const initials = seededMachines.attackFromMars.initials;
  await page.goto(`/m/${initials}/hub?source=apron`);

  await page.getByRole("link", { name: "Report a problem" }).click();

  await expect(page).toHaveURL(`/report?machine=${initials}&source=apron`);
  await expect(page.getByRole("combobox", { name: "Machine" })).toContainText(
    "Attack from Mars"
  );
  await expect(page.getByTestId("report-source")).toHaveValue("apron");
  await expect(page.getByRole("link", { name: "Add details" })).toHaveAttribute(
    "href",
    "/report/detailed?machine=AFM&source=apron"
  );

  await page.getByRole("link", { name: "Add details" }).click();
  await expect(page).toHaveURL("/report/detailed?machine=AFM&source=apron");
  await expect(
    page.getByRole("combobox", { name: "Select Machine" })
  ).toContainText("Attack from Mars");
  await expect(page.getByTestId("report-source")).toHaveValue("apron");
  const loginHref = await page
    .getByRole("link", { name: "Log in" })
    .getAttribute("href");
  expect(loginHref).toBeTruthy();
  if (!loginHref) throw new Error("Expected a login link on Detailed report.");
  const loginUrl = new URL(loginHref, page.url());
  expect(loginUrl.searchParams.get("next")).toBe(
    "/report/detailed?machine=AFM&source=apron"
  );
});

test.describe("artwork band (PP-o355.60)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("shows the band and still fits the smallest phone without scrolling", async ({
    page,
  }) => {
    // Answer OPDB image requests locally; the suite never reaches img.opdb.org.
    await page.route("https://img.opdb.org/**", (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
          "base64"
        ),
      })
    );
    const initials = seededMachines.medievalMadness.initials;
    await page.goto(`/m/${initials}/hub`);

    const band = page.getByTestId("hub-artwork-band");
    await expect(band).toBeVisible();
    await expect(
      band.getByRole("link", { name: "Medieval Madness details" })
    ).toHaveAttribute("href", `/m/${initials}`);
    await expect(
      page.getByRole("link", { name: "Report a problem" })
    ).toBeInViewport();

    const overflow = await page
      .locator("#main-content")
      .evaluate((main) => main.scrollHeight - main.clientHeight);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
