/**
 * Shared filter utilities for issue and machine filtering.
 *
 * These functions extract reusable logic from IssueFilters.tsx and follow
 * the canonical patterns defined in docs/design-consistency/03-patterns.md.
 * They are designed to be shared between desktop and mobile filter UIs.
 */

import {
  STATUS_GROUPS,
  STATUS_CONFIG,
  STATUS_GROUP_LABELS,
  ALL_ISSUE_STATUSES,
  OPEN_STATUSES,
  type IssueStatus,
} from "~/lib/issues/status";

/**
 * Compute a smart badge label for a set of selected statuses.
 *
 * Intended for mobile filter chip labels and dropdown triggers. Desktop
 * IssueFilters uses inline badge logic that creates multiple separate chips;
 * this function returns a single summary label.
 *
 * Priority order (most specific to least specific):
 * 1. No selection -> "Status"
 * 2. All 11 selected -> "All"
 * 3. All open (new + in_progress) -> "Open"
 * 4. All closed -> "Closed"
 * 5. Entire "New" group only -> "Open" (STATUS_GROUP_LABELS.new)
 * 6. Entire "In Progress" group only -> "In Progress"
 * 7. Single status -> status label from STATUS_CONFIG
 * 8. Mixed selection -> "N statuses"
 */
export function getSmartBadgeLabel(selectedStatuses: IssueStatus[]): string {
  if (selectedStatuses.length === 0) {
    return "Status";
  }

  if (selectedStatuses.length === ALL_ISSUE_STATUSES.length) {
    const allPresent = ALL_ISSUE_STATUSES.every((s) =>
      selectedStatuses.includes(s)
    );
    if (allPresent) return "All";
  }

  const hasAllNew = STATUS_GROUPS.new.every((s) =>
    selectedStatuses.includes(s)
  );
  const hasAllInProgress = STATUS_GROUPS.in_progress.every((s) =>
    selectedStatuses.includes(s)
  );
  const hasAllClosed = STATUS_GROUPS.closed.every((s) =>
    selectedStatuses.includes(s)
  );

  // All open = new + in_progress, no closed
  if (
    hasAllNew &&
    hasAllInProgress &&
    !hasAllClosed &&
    selectedStatuses.length === OPEN_STATUSES.length
  ) {
    return "Open";
  }

  // All closed, no open
  if (
    hasAllClosed &&
    !hasAllNew &&
    !hasAllInProgress &&
    selectedStatuses.length === STATUS_GROUPS.closed.length
  ) {
    return "Closed";
  }

  // Entire "New" group only
  if (hasAllNew && selectedStatuses.length === STATUS_GROUPS.new.length) {
    return STATUS_GROUP_LABELS.new;
  }

  // Entire "In Progress" group only
  if (
    hasAllInProgress &&
    selectedStatuses.length === STATUS_GROUPS.in_progress.length
  ) {
    return "In Progress";
  }

  // Single status
  if (selectedStatuses.length === 1) {
    const status = selectedStatuses[0];
    if (status) return STATUS_CONFIG[status].label;
  }

  // Mixed selection
  return `${String(selectedStatuses.length)} statuses`;
}

/**
 * Produce the standardized assignee ordering for dropdown/listbox display.
 *
 * Pattern (from 03-patterns.md):
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

/**
 * Produce the standardized machine quick-select ordering for dropdown display.
 *
 * Pattern (from 03-patterns.md):
 *   "My machines" quick-toggle -> separator -> alphabetical machines
 *
 * When `currentUserId` is null or the user owns no machines, the quick-select
 * and separator are omitted.
 */
export function getMachineQuickSelectOrdering<
  T extends { initials: string; ownerId: string | null },
>(
  machines: T[],
  currentUserId: string | null
): (
  | { type: "quick-select"; label: string; machines: T[] }
  | { type: "separator" }
  | { type: "machine"; machine: T }
)[] {
  type Item =
    | { type: "quick-select"; label: string; machines: T[] }
    | { type: "separator" }
    | { type: "machine"; machine: T };

  const items: Item[] = [];

  const ownedMachines = currentUserId
    ? machines
        .filter((m) => m.ownerId === currentUserId)
        .sort((a, b) => a.initials.localeCompare(b.initials))
    : [];

  if (ownedMachines.length > 0) {
    items.push({
      type: "quick-select",
      label: "My machines",
      machines: ownedMachines,
    });
    items.push({ type: "separator" });
  }

  // All machines alphabetically
  const sorted = [...machines].sort((a, b) =>
    a.initials.localeCompare(b.initials)
  );
  for (const machine of sorted) {
    items.push({ type: "machine", machine });
  }

  return items;
}
