/** Minimal fields required for user sorting (CORE-SEC-006) */
interface ComparableUser {
  id: string;
  name: string;
  lastName: string;
  machineCount: number;
  status: "active" | "invited";
}

/**
 * Comparator for sorting unified users.
 * Order: confirmed users first, then by machine count desc, then by last name, name, and id.
 * Extracted to a separate module so client components can import it without pulling in DB dependencies.
 * Accepts any object with the required fields (CORE-SEC-006: minimal data at boundary).
 */
export function compareUnifiedUsers(
  a: ComparableUser,
  b: ComparableUser
): number {
  // 1. Confirmed (active) users before unconfirmed (invited)
  if (a.status !== b.status) {
    return a.status === "active" ? -1 : 1;
  }

  // 2. Higher machine count first
  const machineCountA = a.machineCount;
  const machineCountB = b.machineCount;
  if (machineCountA !== machineCountB) {
    return machineCountB - machineCountA;
  }

  // 3. Alphabetically by last name
  const lastNameA = a.lastName || "";
  const lastNameB = b.lastName || "";
  const lastNameCompare = lastNameA.localeCompare(lastNameB);
  if (lastNameCompare !== 0) {
    return lastNameCompare;
  }

  // 4. Tie-breaker: full name
  const nameCompare = a.name.localeCompare(b.name);
  if (nameCompare !== 0) {
    return nameCompare;
  }

  // 5. Final tie-breaker: id for deterministic ordering
  return a.id.localeCompare(b.id);
}
