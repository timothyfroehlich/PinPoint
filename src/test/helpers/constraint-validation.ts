import { SEED_TEST_IDS } from "../constants/seed-test-ids";

/**
 * Validates that test data conforms to database constraints
 */
export function validateTestDataConstraints() {
  // Validate SEED_TEST_IDS structure
  const requiredKeys = [
    "ORGANIZATIONS.primary",
    "ORGANIZATIONS.competitor",
    "USERS.ADMIN",
    "USERS.MEMBER1",
    "MACHINES.MEDIEVAL_MADNESS_1",
    "ISSUES.ISSUE_1",
    "MODELS.MEDIEVAL_MADNESS",
    "LOCATIONS.MAIN_FLOOR",
  ];

  for (const key of requiredKeys) {
    const value = key.split(".").reduce((obj, k) => obj?.[k], SEED_TEST_IDS);
    if (!value) {
      throw new Error(`Missing required SEED_TEST_IDS key: ${key}`);
    }
  }

  return true;
}

/**
 * Valid enum values for database constraints
 */
export const VALID_ENUM_VALUES = {
  issueStatus: ["open", "in-progress", "closed"] as const,
  issuePriority: ["low", "medium", "high"] as const,
  machineStatus: ["operational", "maintenance", "out-of-order"] as const,
  machineCondition: ["excellent", "good", "fair", "poor"] as const,
  userRole: ["admin", "member", "guest"] as const,
  auditAction: ["create", "update", "delete"] as const,
  auditEntityType: ["issue", "machine", "user", "organization"] as const,
} as const;

/**
 * Validates that a value is in the allowed enum values
 */
export function validateEnumValue<T extends keyof typeof VALID_ENUM_VALUES>(
  enumType: T,
  value: string,
): value is (typeof VALID_ENUM_VALUES)[T][number] {
  return VALID_ENUM_VALUES[enumType].includes(value as any);
}
