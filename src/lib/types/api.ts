/**
 * Centralized API Types - Single Source of Truth for tRPC Output Types
 *
 * This file defines all core API response types using DrizzleToCamelCase transformations.
 * All tRPC routers import these types to ensure consistency across the application.
 *
 * Usage:
 * ```typescript
 * import { IssueWithRelationsResponse, UserProfileResponse } from "~/lib/types/api";
 * ```
 */

import type { InferSelectModel } from "drizzle-orm";
import type { DrizzleToCamelCase } from "~/lib/utils/case-transformers";
import type {
  issues,
  comments,
  attachments,
  issueStatuses,
  priorities,
  users,
  machines,
  models,
  locations,
  organizations,
  memberships,
  roles,
} from "~/server/db/schema";
import type { LoggerInterface } from "~/lib/logger";
import type { SupabaseServerClient } from "~/lib/supabase/server";
import type { PinPointSupabaseUser } from "~/lib/types";
import type { DrizzleClient } from "~/server/db/drizzle";

// Service Factory and other types that tRPC context needs
type ServiceFactory = any; // TODO: Import proper type when available
type Organization = InferSelectModel<typeof organizations>;
type Membership = InferSelectModel<typeof memberships>;

// ============================================================================
// Core Database Types - Base Drizzle Schema Types
// ============================================================================

// Issue-related base types
type IssueComment = InferSelectModel<typeof comments> & {
  author: Pick<InferSelectModel<typeof users>, "id" | "name" | "image">;
  createdBy: Pick<InferSelectModel<typeof users>, "id" | "name" | "image">; // Alias for author
};

type IssueAttachment = InferSelectModel<typeof attachments>;

// User-related base types
type OwnedMachine = InferSelectModel<typeof machines> & {
  model: InferSelectModel<typeof models>;
  location: InferSelectModel<typeof locations>;
};

type UserMembership = InferSelectModel<typeof memberships> & {
  organization: InferSelectModel<typeof organizations>;
  role: InferSelectModel<typeof roles>;
};

// Machine-related base types
type MachineWithRelations = InferSelectModel<typeof machines> & {
  model: InferSelectModel<typeof models>;
  location: InferSelectModel<typeof locations>;
  owner: Pick<
    InferSelectModel<typeof users>,
    "id" | "name" | "image" | "profile_picture"
  > | null;
};

// ============================================================================
// API Response Types - DrizzleToCamelCase Transformations
// ============================================================================

/** Issue response with full relations (comments, attachments, etc.) */
export interface IssueWithRelationsResponse {
  id: string;
  title: string;
  description: string | null;
  consistency: string | null;
  checklist: unknown;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
  machineId: string;
  createdById: string;
  assignedToId: string | null;
  statusId: string;
  priorityId: string;
  // Anonymous reporting support
  reporterEmail: string | null;
  submitterName: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  assignedTo: Pick<
    DrizzleToCamelCase<InferSelectModel<typeof users>>,
    "id" | "name" | "email" | "image"
  > | null;
  createdBy: Pick<
    DrizzleToCamelCase<InferSelectModel<typeof users>>,
    "id" | "name" | "email" | "image"
  >;
  machine: DrizzleToCamelCase<
    InferSelectModel<typeof machines> & {
      model: InferSelectModel<typeof models>;
      location: InferSelectModel<typeof locations>;
    }
  >;
  comments: DrizzleToCamelCase<
    InferSelectModel<typeof comments> & {
      author: Pick<
        InferSelectModel<typeof users>,
        "id" | "name" | "email" | "image"
      >;
    }
  >[];
  attachments: DrizzleToCamelCase<InferSelectModel<typeof attachments>>[];
}

/** Simple issue response type (without relations) */
export type IssueResponse = DrizzleToCamelCase<InferSelectModel<typeof issues>>;

/** Issue response with full details (alias for IssueWithRelationsResponse) */
export type IssueWithDetails = IssueWithRelationsResponse;

/** Comment response with author info */
export type CommentWithAuthorResponse = DrizzleToCamelCase<IssueComment>;

/** Comment type from issue details (individual comment from issue response) */
export type Comment = NonNullable<IssueWithDetails>["comments"][number];

/** User profile response with full details */
export interface UserProfileResponse {
  id: string;
  name: string | null;
  bio: string | null;
  profilePicture: string | null;
  createdAt: Date;
  ownedMachines: DrizzleToCamelCase<OwnedMachine>[];
  memberships: DrizzleToCamelCase<UserMembership>[];
  _count: {
    ownedMachines: number;
    issuesCreated: number;
    comments: number;
  };
}

/** User membership response */
export interface UserMembershipResponse {
  userId: string;
  role: string;
  organizationId: string;
  permissions: string[];
}

/** User response */
export interface UserResponse {
  id: string;
  name: string | null;
  bio: string | null;
  profilePicture: string | null;
  createdAt: Date;
  _count: {
    ownedMachines: number;
    issuesCreated: number;
    comments: number;
  };
  role?: string;
}

/** Machine response with full relations */
export type MachineResponse = DrizzleToCamelCase<MachineWithRelations>;

/** Machine response with full details */
export type MachineWithDetails = MachineResponse;

/** Location response */
export type LocationResponse = DrizzleToCamelCase<
  InferSelectModel<typeof locations>
>;

/** Location response with aggregated machine and issue data for public dashboard */
export interface LocationWithMachineDetails {
  id: string;
  name: string;
  _count: { machines: number };
  machines: {
    id: string;
    name: string;
    model: {
      name: string;
      manufacturer: string | null;
    };
    _count: { issues: number };
  }[];
}

/** Location response with machine count */
export type LocationWithDetails = LocationResponse;

/** Organization response */
export type OrganizationResponse = DrizzleToCamelCase<
  InferSelectModel<typeof organizations>
>;

/** Minimal public organization listing (for sign-in/landing) */
export interface PublicOrganizationMinimal {
  id: string;
  name: string;
  subdomain: string;
  logoUrl: string | null;
}

/** Role response */
export type RoleResponse = DrizzleToCamelCase<InferSelectModel<typeof roles>>;

/** Model response with machine count */
export interface ModelResponse
  extends DrizzleToCamelCase<InferSelectModel<typeof models>> {
  machineCount: number;
  _count: {
    machines: number;
  };
}

/** Attachment response */
export type AttachmentResponse = DrizzleToCamelCase<
  InferSelectModel<typeof attachments>
>;

/** Notification response */
export interface NotificationResponse {
  id: string;
  type: string;
  title: string;
  message: string;
  userId: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: Date;
  readAt?: Date | null;
}

/** Unread notification count */
export interface UnreadCountResponse {
  count: number;
}

/** Role response with member count and permissions */
export interface RoleResponseWithDetails {
  id: string;
  name: string;
  organizationId: string;
  isSystem: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  memberCount: number;
  permissions: PermissionResponse[];
}

/** Permission response */
export interface PermissionResponse {
  id: string;
  name: string;
  description: string | null;
}

// ============================================================================
// List Types - Array Responses for Collection Endpoints
// ============================================================================

/** Array of issues from list endpoints */
export type IssueList = IssueResponse[];

/** Array of issues from private getAll endpoint with full relations */
export type IssueListWithRelations = IssueWithRelationsResponse[];

/** Array of machines from list endpoints */
export type MachineList = MachineResponse[];

/** Machine for issue creation (minimal data) */
export interface MachineForIssues {
  id: string;
  name: string;
  model: {
    id: string;
    name: string;
    manufacturer: string | null;
    year: number | null;
  };
  location: {
    id: string;
    name: string;
  };
}

/** Array of machines for issue creation */
export type MachineForIssuesList = MachineForIssues[];

/** Array of locations from list endpoints */
export type LocationList = LocationResponse[];

/** Array of users from list endpoints */
export type UserList = UserResponse[];

/** Array of comments from list endpoints */
export type CommentList = CommentWithAuthorResponse[];

/** Array of attachments from list endpoints */
export type AttachmentList = AttachmentResponse[];

/** Array of models from list endpoints */
export type ModelList = ModelResponse[];

/** Array of roles from list endpoints */
export type RoleList = RoleResponse[];

// ============================================================================
// Nested Entity Types - Extracted from Response Relations
// ============================================================================

/** Issue status from API response */
export interface IssueStatus
  extends DrizzleToCamelCase<InferSelectModel<typeof issueStatuses>> {
  color?: string; // Optional color property for UI (fallback logic in components)
}

/** Issue priority from API response */
export interface IssuePriority
  extends DrizzleToCamelCase<InferSelectModel<typeof priorities>> {
  color?: string; // Optional color property for UI (fallback logic in components)
}

/** Machine from issue response */
export type IssueMachine = NonNullable<IssueWithRelationsResponse>["machine"];

/** User from issue response (created by, assigned to) */
export type IssueUser = NonNullable<IssueWithRelationsResponse>["createdBy"];

/** Location from machine response */
export type MachineLocation = NonNullable<MachineResponse>["location"];

/** Model from machine response */
export type MachineModel = NonNullable<MachineResponse>["model"];

/** Owner from machine response */
export type MachineOwner = NonNullable<MachineResponse>["owner"];

// ============================================================================
// Utility Types - Common Patterns
// ============================================================================

/** Status category enumeration */
export type StatusCategory = IssueStatus["category"];

/** Priority level enumeration */
export type PriorityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** Machine status enumeration */
export type MachineStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE";

/** User role enumeration */
export type UserRole = "ADMIN" | "MEMBER" | "VIEWER";

/** Issue sort options */
export type IssueSortBy = "created" | "updated" | "priority" | "status";

/** Sort order options */
export type SortOrder = "asc" | "desc";

// ============================================================================
// Re-exports for Convenience
// ============================================================================

/** Re-export common types for backward compatibility */
export type {
  IssueWithRelationsResponse as Issue,
  MachineResponse as Machine,
  LocationResponse as Location,
  UserResponse as User,
  IssueStatus as Status,
  IssuePriority as Priority,
};

/** Legacy aliases for backward compatibility */
export type IssueWithRelations = IssueWithRelationsResponse;

// ============================================================================
// Export Database Schema Types for Router Use
// ============================================================================

/** Export base types for router internal use (these are the snake_case database types) */
export type {
  IssueWithRelations as IssueWithRelationsDatabase,
  IssueComment as IssueCommentDatabase,
  IssueAttachment as IssueAttachmentDatabase,
  IssueMachine as IssueMachineDatabase,
  OwnedMachine as OwnedMachineDatabase,
  UserMembership as UserMembershipDatabase,
  MachineWithRelations as MachineWithRelationsDatabase,
};

// ============================================================================
// Service Layer Types (migrated from server/services/types.ts)
// ============================================================================

// Service infrastructure types
export type { DrizzleClient } from "~/server/db/drizzle";

// Database utility types
export type DatabaseResult<T> = T;

// Service layer enum re-exports
export {
  notificationTypeEnum,
  notificationEntityEnum,
} from "~/server/db/schema/collections";
export { activityTypeEnum } from "~/server/db/schema/issues";

// Type guard for database results
export function isDatabaseResult(obj: unknown): obj is DatabaseResult<object> {
  if (typeof obj !== "object" || obj === null) return false;
  return Object.keys(obj).some((key) => key.includes("_"));
}

// ============================================================================
// System & Infrastructure Types
// ============================================================================

// System health check result
export interface HealthStatus {
  status: "healthy" | "unhealthy";
  timestamp: string;
  database: "connected" | "disconnected";
  version: string;
  error?: string;
}

// QR Code resolution types
export interface QRCodeResolution {
  success: true;
  reportUrl: string;
  machine: {
    id: string;
    name: string;
    organizationId: string;
    locationId: string;
  };
}

export interface QRCodeResolutionError {
  success: false;
  error: "not_found" | "invalid_id" | "server_error";
  message: string;
}

export type QRCodeResolutionResult = QRCodeResolution | QRCodeResolutionError;

// ============================================================================
// tRPC Context Types
// ============================================================================

/**
 * tRPC context type that includes all available properties
 */
export interface TRPCContext {
  db: DrizzleClient;
  user: PinPointSupabaseUser | null;
  supabase: SupabaseServerClient;
  organizationId: string | null;
  organization: Organization | null;
  services: ServiceFactory;
  headers: Headers;
  logger: LoggerInterface;
  traceId?: string;
  requestId?: string;
}

/**
 * Enhanced context for protected procedures with authenticated user
 */
export interface ProtectedTRPCContext extends TRPCContext {
  user: PinPointSupabaseUser;
  organizationId: string | null;
}

/**
 * Enhanced context for RLS-aware organization procedures
 * organizationId is guaranteed non-null and automatically used by RLS policies
 */
export interface RLSOrganizationTRPCContext extends ProtectedTRPCContext {
  organizationId: string; // Override to be non-null (guaranteed by middleware)
  organization: Organization; // Override to be non-null (guaranteed by middleware)
  membership: Membership;
  userPermissions: string[];
}

/**
 * Legacy organization context for backward compatibility
 * @deprecated Use RLSOrganizationTRPCContext directly
 */
export type OrganizationTRPCContext = RLSOrganizationTRPCContext;
