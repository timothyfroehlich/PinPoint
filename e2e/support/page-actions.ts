/**
 * Page actions on a List View page (list-views §3.7–§3.10): outlined buttons
 * on the title row, then ⋯ ("Actions"), which holds the page's own entries
 * (Export, Print entries, editing) and any action that did not fit its row.
 * Below md ⋯ opens a sheet instead of a menu (§3.10).
 *
 * Which actions fold depends on the room the row has, so a test that only
 * needs to reach an action goes through `clickPageAction` or
 * `choosePageMenuEntry` and works at every width.
 */

import { expect, type Locator, type Page } from "@playwright/test";
import { openDropdownMenu } from "./actions.js";

/** Tailwind's `md`; below it ⋯ opens a sheet (`useIsMobile`). */
const MD_BREAKPOINT_PX = 768;

function opensSheet(page: Page): boolean {
  const width = page.viewportSize()?.width ?? MD_BREAKPOINT_PX;
  return width < MD_BREAKPOINT_PX;
}

/** ⋯, the last page action. By test id: an open menu aria-hides it. */
export function pageActionsTrigger(page: Page): Locator {
  return page.getByTestId("page-actions-menu");
}

/** A page action shown as its own button (or link) on the title row. */
export function pageActionButton(page: Page, name: string | RegExp): Locator {
  const main = page.getByRole("main");
  return main
    .getByRole("button", { name, exact: true })
    .or(main.getByRole("link", { name, exact: true }));
}

/**
 * Opens ⋯ and returns what it opened: the menu from md up, the Actions sheet
 * below it.
 */
export async function openPageActions(page: Page): Promise<Locator> {
  await openDropdownMenu(pageActionsTrigger(page));
  const opened = opensSheet(page)
    ? page.getByRole("dialog", { name: "Actions" })
    : page.getByRole("menu");
  await expect(opened).toBeVisible();
  return opened;
}

/** Closes an open ⋯ and waits for it to go. */
export async function closePageActions(
  page: Page,
  opened: Locator
): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(opened).toBeHidden();
}

/**
 * An entry in an open ⋯: a menu item in the menu, a link or button in the
 * sheet.
 */
export function pageActionsEntry(
  opened: Locator,
  name: string | RegExp
): Locator {
  return opened
    .getByRole("menuitem", { name, exact: true })
    .or(opened.getByRole("link", { name, exact: true }))
    .or(opened.getByRole("button", { name, exact: true }));
}

/** Waits until the page actions have rendered: an action button or ⋯. */
async function waitForPageActions(page: Page, name: string | RegExp) {
  const button = pageActionButton(page, name);
  await expect(button.or(pageActionsTrigger(page)).first()).toBeVisible();
  return button;
}

/**
 * Clicks a page action wherever its row put it: its own button, or its entry
 * in ⋯ once it folded (§3.9). Also reaches an entry ⋯ always holds, such as
 * Export to CSV or Edit collection.
 */
export async function clickPageAction(
  page: Page,
  name: string | RegExp
): Promise<void> {
  const button = await waitForPageActions(page, name);
  if (await button.isVisible()) {
    await button.click();
    return;
  }
  const opened = await openPageActions(page);
  await pageActionsEntry(opened, name).click();
}

/**
 * Chooses an entry of a page action's own menu, such as Print → Settings
 * sheets. Folded into ⋯, the action brings its entries along, sometimes
 * reading differently there (`foldedEntry`, e.g. "Print settings sheets").
 */
export async function choosePageMenuEntry(
  page: Page,
  {
    action,
    entry,
    foldedEntry = entry,
  }: {
    action: string;
    entry: string | RegExp;
    foldedEntry?: string | RegExp;
  }
): Promise<void> {
  const button = await waitForPageActions(page, action);
  if (await button.isVisible()) {
    // The open menu aria-hides its trigger, so retry the click only while
    // the entry is still missing; a click before hydration is dropped.
    const item = page.getByRole("menuitem", { name: entry, exact: true });
    await expect(async () => {
      if (!(await item.isVisible())) await button.click({ timeout: 5_000 });
      await expect(item).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await item.click();
    return;
  }
  const opened = await openPageActions(page);
  await pageActionsEntry(opened, foldedEntry).click();
}

/**
 * Asserts the viewer is offered a page action: as its own button, or as an
 * entry in ⋯. ⋯ is closed again before this returns.
 */
export async function expectPageAction(
  page: Page,
  name: string | RegExp
): Promise<void> {
  const button = await waitForPageActions(page, name);
  if (await button.isVisible()) return;
  const opened = await openPageActions(page);
  await expect(pageActionsEntry(opened, name)).toBeVisible();
  await closePageActions(page, opened);
}

/**
 * Asserts the viewer is not offered a page action anywhere: no button for
 * it, and no entry in ⋯ when the page has one.
 */
export async function expectNoPageAction(
  page: Page,
  name: string | RegExp
): Promise<void> {
  // A viewer may have no page actions at all, so nothing to wait for.
  await expect(pageActionButton(page, name)).toHaveCount(0);
  if ((await pageActionsTrigger(page).count()) === 0) return;
  const opened = await openPageActions(page);
  await expect(pageActionsEntry(opened, name)).toHaveCount(0);
  await closePageActions(page, opened);
}
