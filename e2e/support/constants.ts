import machines from "~/test/data/machines.json" with { type: "json" };
import users from "~/test/data/users.json" with { type: "json" };

export const seededMember = users.member;

export const seededMachines = machines;

export const DEFAULT_NAVIGATION_TIMEOUT = 10_000;

export const TEST_USERS = users;
