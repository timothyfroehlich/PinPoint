import machines from "~/test/data/machines.json" with { type: "json" };
import users from "~/test/data/users.json" with { type: "json" };
import issues from "~/test/data/issues.json" with { type: "json" };

export const seededMember = users.member;

export const seededMachines = machines;

export const seededIssues = issues;

/**
 * Index into a seeded-issue array with a guaranteed-defined result.
 *
 * `noUncheckedIndexedAccess` (ts-strictest) types array access as `T | undefined`.
 * These seeded fixtures are stable, so a missing entry is a test-setup bug worth
 * throwing on rather than silencing with a non-null assertion.
 */
export function seededIssue(
  initials: keyof typeof seededIssues,
  index = 0
): (typeof seededIssues)[keyof typeof seededIssues][number] {
  const issue = seededIssues[initials][index];
  if (issue === undefined) {
    throw new Error(`Missing seeded issue: ${initials}[${index}]`);
  }
  return issue;
}

export const DEFAULT_NAVIGATION_TIMEOUT = 10_000;

export const TEST_USERS = users;

// Machine status based on worst open issue severity
export const machineStatuses = {
  addamsFamily: "Needs Service", // TAF-01, TAF-02 both major
  eightBallDeluxe: "Unplayable", // EBD-01 unplayable
} as const;
