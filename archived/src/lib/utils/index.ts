/**
 * Utility functions barrel export
 *
 * This file provides a clean, organized way to import utilities across the codebase.
 * Utilities are grouped logically for easy discovery and maintenance.
 */

// Case transformation utilities
export {
  toCamelCase,
  toSnakeCase,
  transformKeysToCamelCase,
  transformKeysToSnakeCase,
  type CamelCase,
  type SnakeCase,
  type CamelCased,
  type SnakeCased,
  type DrizzleToCamelCase,
} from "./case-transformers";

// Auth response transformation utilities
export {
  transformUserResponse,
  transformOrganizationResponse,
  transformMembershipResponse,
  transformUploadAuthContextResponse,
  transformAuthUserProfile,
  transformAuthArray,
  transformUserArray,
  transformMembershipArray,
  transformOrganizationArray,
  type UserResponse,
  type OrganizationResponse,
  type MembershipResponse,
  type UploadAuthContextResponse,
  type AuthUserProfile,
} from "./auth-response-transformers";

// Membership transformation utilities
export {
  transformMembershipForValidation,
  transformMembershipsForValidation,
  transformRoleForValidation,
  type MembershipWithUserAndRole,
} from "./membership-transformers";

// ID generation utilities
export { generateId } from "./id-generation";

// Image processing utilities
export {
  processImageFile,
  type ImageProcessingResult,
} from "./image-processing";
