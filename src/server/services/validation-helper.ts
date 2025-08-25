/**
 * @fileoverview Validation helper service to ensure consistent database field access patterns.
 * @see src/server/db/schema/index.ts
 */

import { env } from "~/env.js";

/**
 * A map of common camelCase field names to their snake_case database counterparts.
 * Used for providing helpful error messages during development.
 */
export const COMMON_FIELD_MAPPINGS: Record<string, string> = {
  userId: "user_id",
  organizationId: "organization_id",
  roleId: "role_id",
  profilePicture: "profile_picture",
  emailVerified: "email_verified",
  createdAt: "created_at",
  updatedAt: "updated_at",
  qrCodeId: "qr_code_id",
  isSystem: "is_system",
  isDefault: "is_default",
};

/**
 * Validates that a single field name adheres to the snake_case convention.
 * In development, it throws an error if a known camelCase field is used.
 *
 * @param fieldName - The field name to validate.
 * @throws {Error} If the field name is a known camelCase alias.
 * @example
 * // Correct usage:
 * validateDrizzleFieldAccess('user_id'); // OK
 *
 * // Incorrect usage:
 * validateDrizzleFieldAccess('userId'); // Throws error in development
 */
export function validateDrizzleFieldAccess(fieldName: string): void {
  if (env.NODE_ENV === "development" && fieldName in COMMON_FIELD_MAPPINGS) {
    throw new Error(
      `Incorrect field access: Used '${fieldName}' but should be '${COMMON_FIELD_MAPPINGS[fieldName] ?? "unknown"}'. ` +
        "Database queries must use snake_case for field names.",
    );
  }
}

/**
 * Validates that all keys in a query object (like a `select` or `where` clause)
 * adhere to the snake_case convention.
 *
 * @param query - The query object to inspect.
 * @param expectedFields - An optional array of expected snake_case fields for more precise validation.
 * @throws {Error} If any field does not follow the snake_case convention.
 */
export function validateQueryFields(
  query: object,
  expectedFields?: string[],
): void {
  // This validation is expensive and should only run when explicitly enabled.
  if (env.NODE_ENV !== "development") {
    return;
  }

  for (const key of Object.keys(query)) {
    validateDrizzleFieldAccess(key);
    if (expectedFields && !expectedFields.includes(key)) {
      console.warn(
        `Field '${key}' was found in the query but was not in the list of expected fields. ` +
          `Expected: [${expectedFields.join(", ")}]`,
      );
    }
  }
}

/**
 * A type guard to check if an object from the database has snake_case fields.
 * This is a lightweight check and primarily for runtime confidence during development.
 *
 * @param result - The database result object.
 * @returns True if the object appears to have snake_case fields.
 */
export function isSnakeCaseResult(result: object): boolean {
  const keys = Object.keys(result);
  return keys.some((key) => key.includes("_"));
}

/**
 * Scans a Drizzle query object for potential field naming issues during development.
 * This function is intended for debugging and testing, and only runs if
 * `NODE_ENV` is 'development' and `DB_AUDIT_QUERIES` is 'true'.
 *
 * @param queryObject - The Drizzle query object to audit.
 */
export function auditDatabaseQuery(queryObject: object): void {
  if (env.NODE_ENV !== "development") {
    return;
  }

  console.log("Auditing database query object:", queryObject);
  try {
    validateQueryFields(queryObject);
    console.log(
      "Audit passed: All field names appear to be correct snake_case.",
    );
  } catch (error) {
    console.error("Audit failed:", error);
  }
}
