/**
 * Shared navigation utilities for active state detection.
 *
 * Extracted from BottomTabBar so both AppHeader and BottomTabBar use
 * identical logic for determining which nav item is active.
 */

/** Matches issue detail pages: /m/[initials]/i or /m/[initials]/i/[number] */
const ISSUE_DETAIL_PATTERN = /^\/m\/[^/]+\/i(\/|$)/;

/**
 * Returns true when the given nav item should appear active for the current pathname.
 *
 * Special cases:
 * - Issue detail pages (`/m/[initials]/i/...`) activate the Issues tab, NOT Machines.
 * - The Issues href is resolved from the user's saved filter path (e.g. `/issues?status=open`).
 */
export function isNavItemActive(
  tabHref: string,
  pathname: string,
  resolvedIssuesPath: string
): boolean {
  // Issue detail pages (/m/[initials]/i and /m/[initials]/i/[number]) belong to the Issues tab
  const isIssuePage = ISSUE_DETAIL_PATTERN.test(pathname);

  const href = tabHref === "/issues" ? resolvedIssuesPath : tabHref;
  const basePath = href.split("?")[0] ?? href;

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
