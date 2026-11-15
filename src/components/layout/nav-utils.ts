/**
 * Shared navigation utilities for active state detection.
 *
 * Extracted from BottomTabBar so both AppHeader and BottomTabBar use
 * identical logic for determining which nav item is active.
 */

/** Matches machine issues routes: /m/[initials]/i (list) or /m/[initials]/i/[number] (detail) */
const ISSUE_DETAIL_PATTERN = /^\/m\/[^/]+\/i(\/|$)/;

/**
 * Returns true when the given nav item should appear active for the current pathname.
 *
 * Special cases:
 * - Issue detail pages (`/m/[initials]/i/...`) activate the Issues tab, NOT Machines.
 * - `tabHref` is the item's plain path; a link may carry a remembered list
 *   query (list-views §11.1), which never affects which item is active.
 */
export function isNavItemActive(tabHref: string, pathname: string): boolean {
  // Issue detail pages (/m/[initials]/i and /m/[initials]/i/[number]) belong to the Issues tab
  const isIssuePage = ISSUE_DETAIL_PATTERN.test(pathname);

  const basePath = tabHref.split("?")[0] ?? tabHref;

  if (basePath === "/m") {
    // Machines tab: match /m/* but NOT issue detail pages
    return pathname.startsWith("/m") && !isIssuePage;
  }
  if (basePath.startsWith("/issues")) {
    // Issues tab: match /issues/* OR issue detail pages
    return pathname.startsWith(basePath) || isIssuePage;
  }
  return pathname === basePath;
}
