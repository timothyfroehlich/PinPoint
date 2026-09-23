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
