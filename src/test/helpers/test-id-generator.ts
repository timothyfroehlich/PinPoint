/**
 * ❌ DEPRECATED: Test ID Generator Functions
 *
 * These functions violate NON_NEGOTIABLES.md and have been replaced with
 * helpful error messages to guide conversion to SEED_TEST_IDS pattern.
 *
 * @see NON_NEGOTIABLES.md - SEED_TEST_IDS Usage section
 * @see src/test/constants/seed-test-ids.ts - Predefined test constants
 */

const CONVERSION_GUIDE = `
❌ DEPRECATED: Random test IDs violate NON_NEGOTIABLES.md

✅ REQUIRED: Use SEED_TEST_IDS for predictable testing:

// ❌ OLD (random IDs break predictable debugging)
const testUserId = generateTestId("user");
const testOrgId = generateTestId("org");

// ✅ NEW (hardcoded predictable IDs)
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
const testUserId = SEED_TEST_IDS.USERS.ADMIN;
const testOrgId = SEED_TEST_IDS.ORGANIZATIONS.primary;

Available SEED_TEST_IDS patterns:
- ORGANIZATIONS.primary / .competitor
- USERS.ADMIN / .REGULAR_USER / .COMPETITOR_USER  
- MACHINES.* (various test machines)
- LOCATIONS.* (various test locations)
- MOCK_PATTERNS.* (for test-specific data)

See NON_NEGOTIABLES.md and src/test/constants/seed-test-ids.ts for complete patterns.
`;

/**
 * @deprecated Use SEED_TEST_IDS instead - see error message for conversion guide
 */
export function generateTestId(prefix = "test"): never {
  throw new Error(CONVERSION_GUIDE);
}

/**
 * @deprecated Use SEED_TEST_IDS instead - see error message for conversion guide
 */
export function generateTestEmail(prefix = "test"): never {
  throw new Error(CONVERSION_GUIDE);
}

/**
 * @deprecated Use SEED_TEST_IDS instead - see error message for conversion guide
 */
export function generateTestSubdomain(prefix = "test"): never {
  throw new Error(CONVERSION_GUIDE);
}

/**
 * @deprecated Use SEED_TEST_IDS instead - see error message for conversion guide
 */
export function generateTestIds(count: number, prefix = "test"): never {
  throw new Error(CONVERSION_GUIDE);
}
