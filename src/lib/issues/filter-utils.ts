/**
 * Shared filter utilities for the issue filter bar.
 *
 * These functions extract reusable logic from IssueFilters.tsx and follow
 * the canonical filter-bar conventions in
 * .agents/skills/pinpoint-ui/references/filter-conventions.md.
 */

/**
 * Produce the standardized assignee ordering for dropdown/listbox display.
 *
 * Pattern (see .agents/skills/pinpoint-ui/references/filter-conventions.md):
 *   Me (current user) -> Unassigned -> separator -> alphabetical users
 *
 * When `currentUserId` is null, the "Me" entry is omitted.
 */
export function getAssigneeOrdering<T extends { id: string; name: string }>(
  users: T[],
  currentUserId: string | null
): (
  | { type: "quick-select"; label: string; value: string; user?: T }
  | { type: "separator" }
  | { type: "user"; user: T }
)[] {
  type Item =
    | { type: "quick-select"; label: string; value: string; user?: T }
    | { type: "separator" }
    | { type: "user"; user: T };

  const items: Item[] = [];

  const currentUser = currentUserId
    ? (users.find((u) => u.id === currentUserId) ?? null)
    : null;

  // Quick-selects
  if (currentUser) {
    items.push({
      type: "quick-select",
      label: "Me",
      value: currentUser.id,
      user: currentUser,
    });
  }

  items.push({
    type: "quick-select",
    label: "Unassigned",
    value: "UNASSIGNED",
  });

  // Separator
  items.push({ type: "separator" });

  // Alphabetical users (excluding current user)
  const remaining = users
    .filter((u) => u.id !== currentUserId)
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const user of remaining) {
    items.push({ type: "user", user });
  }

  return items;
}
