/**
 * Database Utilities - Barrel Export
 *
 * Centralized exports for all database utility functions and validation.
 * Provides a single entry point for database-related utilities.
 *
 * @example
 * ```typescript
 * import {
 *   validateFieldExists,
 *   withOrganizationScope,
 *   validateQueryFields
 * } from '~/server/db/utils';
 * ```
 */

// =================================
// FIELD VALIDATION UTILITIES
// =================================

export {
  validateFieldExists,
  validateFieldAccess,
  getFieldMapping,
  isCamelCase,
  convertToSnakeCase,
  validateCommonPattern,
  devValidateFields,
  FIELD_MAPPINGS,
  COMMON_FIELDS,
  type TableName,
} from "./field-validation";

// =================================
// COMMON QUERY UTILITIES
// =================================

export {
  withOrganizationScope,
  excludeSoftDeleted,
  withOrgScopeAndNotDeleted,
  getSingleRecordWithLimit,
  validateQueryFields,
  COMMON_ERRORS,
} from "./common-queries";

// =================================
// ROLE VALIDATION UTILITIES
// =================================

export { ensureAtLeastOneAdmin } from "./role-validation";

// =================================
// USAGE EXAMPLES & DOCUMENTATION
// =================================

/**
 * @fileoverview Database Utilities Usage Guide
 *
 * Field validation utilities help ensure consistent snake_case field usage.
 * Common query utilities provide consistent patterns for database operations.
 * Role validation utilities are available in role-validation.ts.
 */
