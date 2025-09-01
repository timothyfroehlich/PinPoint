/**
 * Shared validation types for consistent interface across validation modules
 * Extracted from duplicated types in roleManagementValidation.ts and assignmentValidation.ts
 */

export interface ValidationUser {
  readonly id: string;
  readonly name: string | null;
  readonly email: string;
}