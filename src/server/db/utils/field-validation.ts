/**
 * Database Field Validation Utilities
 *
 * Provides validation for database field access to ensure correct snake_case
 * field names are used and prevent regressions from camelCase usage.
 *
 * @example
 * ```typescript
 * // Validate field exists in schema
 * validateFieldExists('users', 'email'); // true
 * validateFieldExists('users', 'emailAddress'); // false
 *
 * // Get field mapping suggestions
 * getFieldMapping('logoUrl'); // 'logo_url'
 * getFieldMapping('createdAt'); // 'created_at'
 * ```
 */

import { env } from "~/env.js";

// =================================
// TYPE DEFINITIONS
// =================================

type TableName =
  | "users"
  | "organizations"
  | "locations"
  | "machines"
  | "models"
  | "issues"
  | "memberships"
  | "roles"
  | "permissions";

export type { TableName };

// =================================
// FIELD MAPPINGS
// =================================

/**
 * Common camelCase to snake_case field mappings
 * Used to suggest correct field names when validation fails
 */
export const FIELD_MAPPINGS: Record<string, string> = {
  // Common timestamp fields
  createdAt: "created_at",
  updatedAt: "updated_at",
  deletedAt: "deleted_at",

  // Common ID fields
  userId: "user_id",
  organizationId: "organization_id",
  locationId: "location_id",
  machineId: "machine_id",
  modelId: "model_id",
  issueId: "issue_id",
  membershipId: "membership_id",
  roleId: "role_id",
  permissionId: "permission_id",

  // User fields
  emailVerified: "email_verified",
  profilePicture: "profile_picture",
  emailNotificationsEnabled: "email_notifications_enabled",
  pushNotificationsEnabled: "push_notifications_enabled",
  notificationFrequency: "notification_frequency",

  // Organization fields
  logoUrl: "logo_url",

  // Models fields
  opdbId: "opdb_id",
  ipdbId: "ipdb_id",
  isCustom: "is_custom",
  isActive: "is_active",
  machineType: "machine_type",
  machineDisplay: "machine_display",
  ipdbLink: "ipdb_link",
  opdbImgUrl: "opdb_img_url",
  kineticistUrl: "kineticist_url",

  // Machines fields
  ownerId: "owner_id",
  ownerNotificationsEnabled: "owner_notifications_enabled",
  notifyOnNewIssues: "notify_on_new_issues",
  notifyOnStatusChanges: "notify_on_status_changes",
  notifyOnComments: "notify_on_comments",
  qrCodeId: "qr_code_id",
  qrCodeUrl: "qr_code_url",
  qrCodeGeneratedAt: "qr_code_generated_at",

  // Location fields
  pinballMapId: "pinball_map_id",
  regionId: "region_id",
  lastSyncAt: "last_sync_at",
  syncEnabled: "sync_enabled",

  // Issues fields
  reportedById: "reported_by_id",
  assignedToId: "assigned_to_id",
  priorityId: "priority_id",
  statusId: "status_id",
  resolvedAt: "resolved_at",
  resolvedById: "resolved_by_id",
  isArchived: "is_archived",

  // Roles and permissions
  isSystem: "is_system",
  isDefault: "is_default",
};

// =================================
// VALIDATION FUNCTIONS
// =================================

/**
 * Get the correct snake_case field name for a camelCase field
 * @param camelCaseField - The camelCase field name
 * @returns The corresponding snake_case field name, or the original if no mapping exists
 */
export function getFieldMapping(camelCaseField: string): string {
  return FIELD_MAPPINGS[camelCaseField] ?? camelCaseField;
}

/**
 * Check if a field name appears to be camelCase
 * @param fieldName - The field name to check
 * @returns True if the field appears to be camelCase
 */
export function isCamelCase(fieldName: string): boolean {
  // Check if the field contains uppercase letters (excluding the first character)
  return /[a-z][A-Z]/.test(fieldName);
}

/**
 * Validate that a field exists in a table schema
 * Note: This is a runtime check and doesn't validate against actual schema types
 * @param tableName - The name of the table
 * @param fieldName - The name of the field to validate
 * @returns Object with validation result and suggestions
 */
export function validateFieldExists(
  _tableName: TableName,
  fieldName: string,
): {
  valid: boolean;
  message?: string;
  suggestion?: string;
} {
  // Check if field appears to be camelCase
  if (isCamelCase(fieldName)) {
    const snakeCase = getFieldMapping(fieldName);
    return {
      valid: false,
      message: `Field '${fieldName}' appears to be camelCase. Database uses snake_case.`,
      suggestion:
        snakeCase !== fieldName ? snakeCase : convertToSnakeCase(fieldName),
    };
  }

  return {
    valid: true,
  };
}

/**
 * Convert a camelCase string to snake_case
 * @param camelCase - The camelCase string to convert
 * @returns The snake_case equivalent
 */
export function convertToSnakeCase(camelCase: string): string {
  return camelCase.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Validate field access in a query context
 * Useful for development-time validation of database queries
 * @param tableName - The table being queried
 * @param fields - Array of field names being accessed
 * @returns Array of validation results for each field
 */
export function validateFieldAccess(
  tableName: TableName,
  fields: string[],
): { field: string; valid: boolean; message?: string; suggestion?: string }[] {
  return fields.map((field) => ({
    field,
    ...validateFieldExists(tableName, field),
  }));
}

/**
 * Development-mode field validation
 * Only performs validation when NODE_ENV is 'development'
 * @param tableName - The table being queried
 * @param fields - Array of field names being accessed
 * @throws Error if validation fails in development mode
 */
export function devValidateFields(
  tableName: TableName,
  fields: string[],
): void {
  if (env.NODE_ENV !== "development") {
    return;
  }

  const results = validateFieldAccess(tableName, fields);
  const failures = results.filter((r) => !r.valid);

  if (failures.length > 0) {
    const messages = failures.map(
      (f) =>
        `${f.field}: ${f.message ?? "Unknown error"}${f.suggestion ? ` Try: '${f.suggestion}'` : ""}`,
    );

    throw new Error(
      `Field validation failed for table '${tableName}':\n${messages.join("\n")}`,
    );
  }
}

// =================================
// UTILITY EXPORTS
// =================================

/**
 * Common field validation patterns for frequently used fields
 */
export const COMMON_FIELDS = {
  TIMESTAMPS: ["created_at", "updated_at"] as const,
  USER_RELATION: ["user_id"] as const,
  ORG_RELATION: ["organization_id"] as const,
  SOFT_DELETE: ["deleted_at"] as const,
} as const;

/**
 * Validate common field patterns
 * @param tableName - The table name
 * @param pattern - The pattern to validate
 */
export function validateCommonPattern(
  tableName: TableName,
  pattern: keyof typeof COMMON_FIELDS,
): ReturnType<typeof validateFieldAccess> {
  return validateFieldAccess(tableName, [...COMMON_FIELDS[pattern]]);
}
