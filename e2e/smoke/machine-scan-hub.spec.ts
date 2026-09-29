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

  test("shows the band, peeks the next card, and pins the actions while scrolling", async ({
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
    const report = page.getByRole("link", { name: "Report a problem" });
    await expect(report).toBeInViewport();

    // Spec §3.7, §5.4: the band leaves at least the top 60px of the card after
    // Top scores showing above the pinned actions, and never drops below 180px.
    const layout = await page.evaluate(() => {
      const scores = document.querySelector(
        "section[aria-labelledby=hub-scores-heading]"
      );
      const next = scores?.nextElementSibling;
      const actions = document.querySelector('[aria-label="Machine actions"]');
      const art = document.querySelector("[data-testid=hub-artwork-band]");
      return {
        nextTop: next?.getBoundingClientRect().top ?? Infinity,
        actionsTop: actions?.getBoundingClientRect().top ?? 0,
        bandHeight: art?.getBoundingClientRect().height ?? 0,
      };
    });
    expect(layout.actionsTop - layout.nextTop).toBeGreaterThanOrEqual(60);
    expect(layout.bandHeight).toBeGreaterThanOrEqual(180);

    // Spec §5.5: the hub scrolls and the actions stay pinned.
    await page
      .locator("#main-content")
      .evaluate((main) => main.scrollTo(0, main.scrollHeight));
    await expect(report).toBeInViewport();
  });
});
