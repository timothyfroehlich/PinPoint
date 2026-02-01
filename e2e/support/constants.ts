import machines from "~/test/data/machines.json" with { type: "json" };
import users from "~/test/data/users.json" with { type: "json" };
import issues from "~/test/data/issues.json" with { type: "json" };

export const seededMember = users.member;

export const seededMachines = machines;

export const seededIssues = issues;

export const DEFAULT_NAVIGATION_TIMEOUT = 10_000;

export const TEST_USERS = users;

// Machine status based on worst open issue severity
export const machineStatuses = {
  addamsFamily: "Needs Service", // TAF-01, TAF-02 both major
  eightBallDeluxe: "Unplayable", // EBD-01 unplayable
} as const;
