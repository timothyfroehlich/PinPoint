/**
 * Infrastructure Seeding - Unified with Shared Utilities
 *
 * Shared seeding for organizations, permissions, roles, priorities, statuses.
 * Uses SeedMapper to eliminate switch statements and standardize patterns.
 *
 * Note: This file uses snake_case field names for database operations
 * to match the actual database schema. Any transformation between camelCase
 * and snake_case should be handled at the application boundary.
 */

// Node modules
import { eq } from "drizzle-orm";

// Internal utilities
import { createDrizzleClient } from "~/server/db/drizzle";
import { SEED_TEST_IDS } from "./constants";
import {
  SeedLogger,
  SeedMapper,
  withErrorContext,
  createSeedResult,
  createFailedSeedResult,
  type SeedResult,
} from "./seed-utilities";

// Schema imports
import {
  organizations,
  locations,
  permissions,
  roles,
  rolePermissions,
  priorities,
  issueStatuses,
  collectionTypes,
} from "~/server/db/schema";

// Auth constants
import {
  ALL_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  SYSTEM_ROLES,
  ROLE_TEMPLATES,
  UNAUTHENTICATED_PERMISSIONS,
} from "~/server/auth/permissions.constants";

const db = createDrizzleClient();

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  subdomain: string;
}

export interface DualOrganizationSetup {
  primary: Organization;
  secondary: Organization;
}

// ============================================================================
// Permission ID Mapping
// ============================================================================

const PERMISSION_ID_MAP: Record<string, string> = {
  "issue:view": SEED_TEST_IDS.PERMISSIONS.ISSUE_VIEW,
  "issue:create": SEED_TEST_IDS.PERMISSIONS.ISSUE_CREATE,
  "issue:edit": SEED_TEST_IDS.PERMISSIONS.ISSUE_EDIT,
  "issue:delete": SEED_TEST_IDS.PERMISSIONS.ISSUE_DELETE,
  "issue:assign": SEED_TEST_IDS.PERMISSIONS.ISSUE_ASSIGN,
  "issue:bulk_manage": SEED_TEST_IDS.PERMISSIONS.ISSUE_BULK_MANAGE,
  "machine:view": SEED_TEST_IDS.PERMISSIONS.MACHINE_VIEW,
  "machine:create": SEED_TEST_IDS.PERMISSIONS.MACHINE_CREATE,
  "machine:edit": SEED_TEST_IDS.PERMISSIONS.MACHINE_EDIT,
  "machine:delete": SEED_TEST_IDS.PERMISSIONS.MACHINE_DELETE,
  "location:view": SEED_TEST_IDS.PERMISSIONS.LOCATION_VIEW,
  "location:create": SEED_TEST_IDS.PERMISSIONS.LOCATION_CREATE,
  "location:edit": SEED_TEST_IDS.PERMISSIONS.LOCATION_EDIT,
  "location:delete": SEED_TEST_IDS.PERMISSIONS.LOCATION_DELETE,
  "attachment:view": SEED_TEST_IDS.PERMISSIONS.ATTACHMENT_VIEW,
  "attachment:create": SEED_TEST_IDS.PERMISSIONS.ATTACHMENT_CREATE,
  "attachment:delete": SEED_TEST_IDS.PERMISSIONS.ATTACHMENT_DELETE,
  "organization:manage": SEED_TEST_IDS.PERMISSIONS.ORGANIZATION_MANAGE,
  "role:manage": SEED_TEST_IDS.PERMISSIONS.ROLE_MANAGE,
  "user:manage": SEED_TEST_IDS.PERMISSIONS.USER_MANAGE,
  "admin:view_analytics": SEED_TEST_IDS.PERMISSIONS.ADMIN_VIEW_ANALYTICS,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get default location ID for organization
 */
function getDefaultLocationId(orgId: string): string {
  const isPrimary = orgId === SEED_TEST_IDS.ORGANIZATIONS.primary;
  return isPrimary
    ? SEED_TEST_IDS.LOCATIONS.DEFAULT_PRIMARY
    : SEED_TEST_IDS.LOCATIONS.DEFAULT_COMPETITOR;
}

// ============================================================================
// Global Permissions
// ============================================================================

/**
 * Create global permissions with unified error handling
 */
async function createGlobalPermissions(): Promise<void> {
  const existingPermissions = await db
    .select({ name: permissions.name })
    .from(permissions);

  const existingSet = new Set(existingPermissions.map((p) => p.name));

  const permissionsToCreate: (typeof permissions.$inferInsert)[] =
    ALL_PERMISSIONS.filter((permName) => !existingSet.has(permName)).map(
      (permName) => ({
        id:
          // eslint-disable-next-line security/detect-object-injection
          PERMISSION_ID_MAP[permName] ??
          `perm-fallback-${permName.replace(/[^a-z0-9]/gi, "-")}`,
        name: permName,
        description:
          // eslint-disable-next-line security/detect-object-injection
          PERMISSION_DESCRIPTIONS[permName] ?? `Permission: ${permName}`,
      }),
    );

  if (permissionsToCreate.length > 0) {
    await db.insert(permissions).values(permissionsToCreate);
    SeedLogger.success(
      `Created ${String(permissionsToCreate.length)} global permissions`,
    );
  }
}

// ============================================================================
// Organization Management
// ============================================================================

/**
 * Create organization with automatic default roles
 */
async function createOrganizationWithRoles(orgData: {
  id?: string;
  name: string;
  subdomain: string;
  logoUrl?: string;
}): Promise<Organization> {
  const result = await db
    .insert(organizations)
    .values({
      id: orgData.id ?? `org-fallback-${orgData.subdomain}`,
      name: orgData.name,
      subdomain: orgData.subdomain,
      logo_url: orgData.logoUrl,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: organizations.subdomain,
      set: {
        name: orgData.name,
        logo_url: orgData.logoUrl,
        updated_at: new Date(),
      },
    })
    .returning();

  const organization = result[0];
  if (!organization) {
    throw new Error("Failed to upsert organization");
  }

  // Create system roles and default member role
  await withErrorContext(
    "INFRASTRUCTURE",
    `create system roles for ${organization.name}`,
    () => createSystemRoles(organization.id),
  );

  await withErrorContext(
    "INFRASTRUCTURE",
    `create member role template for ${organization.name}`,
    () => createTemplateRole(organization.id, "MEMBER"),
  );

  return {
    id: organization.id,
    name: organization.name,
    subdomain: organization.subdomain,
  };
}

// ============================================================================
// Priorities Management
// ============================================================================

/**
 * Create default priorities for organization
 */
async function createDefaultPriorities(organization_id: string): Promise<void> {
  const priorityData = [
    { name: "Low", order: 1 },
    { name: "Medium", order: 2 },
    { name: "High", order: 3 },
    { name: "Critical", order: 4 },
  ];

  const existingPriorities = await db
    .select({ name: priorities.name })
    .from(priorities)
    .where(eq(priorities.organization_id, organization_id));

  const existingSet = new Set(existingPriorities.map((p) => p.name));

  const prioritiesToCreate: (typeof priorities.$inferInsert)[] = priorityData
    .filter((priority) => !existingSet.has(priority.name))
    .map((priority) => ({
      id: SeedMapper.getPriorityId(priority.name, organization_id),
      name: priority.name,
      order: priority.order,
      organization_id: organization_id,
      is_default: true,
    }));

  if (prioritiesToCreate.length > 0) {
    await db.insert(priorities).values(prioritiesToCreate);
  }
}

// ============================================================================
// Collection Types Management
// ============================================================================

/**
 * Create default collection types for organization
 */
async function createDefaultCollectionTypes(
  organization_id: string,
): Promise<void> {
  const typeData = [
    { name: "Rooms", description: "Organize machines by physical location" },
    { name: "Manufacturer", description: "Group machines by manufacturer" },
    { name: "Era", description: "Group machines by time period" },
  ];

  const existingTypes = await db
    .select({ name: collectionTypes.name })
    .from(collectionTypes)
    .where(eq(collectionTypes.organization_id, organization_id));

  const existingSet = new Set(existingTypes.map((t) => t.name));

  const typesToCreate: (typeof collectionTypes.$inferInsert)[] = typeData
    .filter((type) => !existingSet.has(type.name))
    .map((typeData) => ({
      id: SeedMapper.getCollectionTypeId(typeData.name, organization_id),
      name: typeData.name,
      description: typeData.description,
      organization_id: organization_id,
      is_default: true,
    }));

  if (typesToCreate.length > 0) {
    await db.insert(collectionTypes).values(typesToCreate);
  }
}

// ============================================================================
// Issue Statuses Management
// ============================================================================

/**
 * Create default issue statuses for organization
 */
async function createDefaultIssueStatuses(
  organization_id: string,
): Promise<void> {
  const statusData = [
    {
      name: "New",
      color: "#ef4444",
      description: "Newly reported issue",
      category: "NEW",
    },
    {
      name: "In Progress",
      color: "#f59e0b",
      description: "Currently being worked on",
      category: "IN_PROGRESS",
    },
    {
      name: "Needs Expert",
      color: "#8b5cf6",
      description: "Requires expert assistance",
      category: "IN_PROGRESS",
    },
    {
      name: "Needs Parts",
      color: "#06b6d4",
      description: "Waiting for replacement parts",
      category: "IN_PROGRESS",
    },
    {
      name: "Fixed",
      color: "#10b981",
      description: "Issue resolved",
      category: "RESOLVED",
    },
    {
      name: "Not to be Fixed",
      color: "#6b7280",
      description: "Intentionally not fixing",
      category: "RESOLVED",
    },
    {
      name: "Not Reproducible",
      color: "#6b7280",
      description: "Cannot reproduce the issue",
      category: "RESOLVED",
    },
  ];

  const existingStatuses = await db
    .select({ name: issueStatuses.name })
    .from(issueStatuses)
    .where(eq(issueStatuses.organization_id, organization_id));

  const existingSet = new Set(existingStatuses.map((s) => s.name));

  const statusesToCreate = statusData
    .filter((status) => !existingSet.has(status.name))
    .map((statusData) => ({
      id: SeedMapper.getStatusId(statusData.name, organization_id),
      name: statusData.name,
      color: statusData.color,
      description: statusData.description,
      category: statusData.category as "NEW" | "IN_PROGRESS" | "RESOLVED",
      organization_id: organization_id,
      is_default: true,
    })) as {
    id: string;
    name: string;
    color: string;
    description: string;
    category: "NEW" | "IN_PROGRESS" | "RESOLVED";
    organization_id: string;
    is_default: boolean;
  }[];

  if (statusesToCreate.length > 0) {
    await db.insert(issueStatuses).values(statusesToCreate);
  }
}

// ============================================================================
// Roles & Permissions Management
// ============================================================================

/**
 * Create system roles for organization
 */
async function createSystemRoles(organization_id: string): Promise<void> {
  // Get all permissions for role assignments
  const allPermissions = await db.select().from(permissions);
  const permissionMap = new Map(allPermissions.map((p) => [p.name, p.id]));

  // Create Admin role with all permissions
  await db
    .insert(roles)
    .values({
      id: SeedMapper.getRoleId(SYSTEM_ROLES.ADMIN, organization_id),
      name: SYSTEM_ROLES.ADMIN,
      organization_id: organization_id,
      is_system: true,
    })
    .onConflictDoNothing();

  // Create role-permission assignments for Admin
  const adminRolePermissions = allPermissions.map((permission) => ({
    role_id: SeedMapper.getRoleId(SYSTEM_ROLES.ADMIN, organization_id),
    permission_id: permission.id,
  }));

  await db
    .insert(rolePermissions)
    .values(adminRolePermissions)
    .onConflictDoNothing();

  // Create Unauthenticated role with limited permissions
  const unauthPermissions = UNAUTHENTICATED_PERMISSIONS.map((permName) =>
    permissionMap.get(permName),
  ).filter((id): id is string => id !== undefined);

  await db
    .insert(roles)
    .values({
      id: SeedMapper.getRoleId(SYSTEM_ROLES.UNAUTHENTICATED, organization_id),
      name: SYSTEM_ROLES.UNAUTHENTICATED,
      organization_id: organization_id,
      is_system: true,
    })
    .onConflictDoNothing();

  // Create role-permission assignments for Unauthenticated
  if (unauthPermissions.length > 0) {
    const unauthRolePermissions = unauthPermissions.map((permissionId) => ({
      role_id: SeedMapper.getRoleId(
        SYSTEM_ROLES.UNAUTHENTICATED,
        organization_id,
      ),
      permission_id: permissionId,
    }));

    await db
      .insert(rolePermissions)
      .values(unauthRolePermissions)
      .onConflictDoNothing();
  }
}

/**
 * Create template role for organization
 */
async function createTemplateRole(
  organization_id: string,
  templateName: keyof typeof ROLE_TEMPLATES,
): Promise<void> {
  // Type-safe template lookup with validation
  if (!(templateName in ROLE_TEMPLATES)) {
    throw new Error(`Unknown role template: ${templateName}`);
  }

  // Safe access after validation
  const template = ROLE_TEMPLATES[templateName];

  // Get permissions for this template
  const allPermissions = await db.select().from(permissions);
  const permissionMap = new Map(allPermissions.map((p) => [p.name, p.id]));

  const templatePermissions = template.permissions
    .map((permName) => permissionMap.get(permName))
    .filter((id): id is string => id !== undefined);

  await db
    .insert(roles)
    .values({
      id: SeedMapper.getRoleId(template.name, organization_id),
      name: template.name,
      organization_id: organization_id,
      is_system: false,
    })
    .onConflictDoNothing();

  // Create role-permission assignments
  if (templatePermissions.length > 0) {
    const templateRolePermissions = templatePermissions.map((permissionId) => ({
      role_id: SeedMapper.getRoleId(template.name, organization_id),
      permission_id: permissionId,
    }));

    await db
      .insert(rolePermissions)
      .values(templateRolePermissions)
      .onConflictDoNothing();
  }
}

// ============================================================================
// Default Locations Management
// ============================================================================

/**
 * Create default location for organization
 */
async function createDefaultLocation(organization_id: string): Promise<void> {
  await db
    .insert(locations)
    .values({
      id: getDefaultLocationId(organization_id),
      name: "Main Floor",
      description: "Primary location for machines",
      organization_id: organization_id,
    })
    .onConflictDoNothing();
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Main infrastructure seeding function with unified patterns
 */
export async function seedInfrastructure(): Promise<
  SeedResult<DualOrganizationSetup>
> {
  const startTime = Date.now();

  try {
    // Create global permissions first
    await withErrorContext("INFRASTRUCTURE", "create global permissions", () =>
      createGlobalPermissions(),
    );

    // Create dual organizations
    const [primaryOrg, secondaryOrg] = await Promise.all([
      withErrorContext("INFRASTRUCTURE", "create primary organization", () =>
        createOrganizationWithRoles({
          id: SEED_TEST_IDS.ORGANIZATIONS.primary,
          name: "Austin Pinball Collective",
          subdomain: "apc",
        }),
      ),
      withErrorContext("INFRASTRUCTURE", "create secondary organization", () =>
        createOrganizationWithRoles({
          id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
          name: "Competitor Arcade",
          subdomain: "competitor-arcade",
        }),
      ),
    ]);

    // Create organization-specific infrastructure for both organizations
    await Promise.all([
      // Primary organization infrastructure
      withErrorContext("INFRASTRUCTURE", "create primary org priorities", () =>
        createDefaultPriorities(primaryOrg.id),
      ),
      withErrorContext(
        "INFRASTRUCTURE",
        "create primary org collection types",
        () => createDefaultCollectionTypes(primaryOrg.id),
      ),
      withErrorContext(
        "INFRASTRUCTURE",
        "create primary org issue statuses",
        () => createDefaultIssueStatuses(primaryOrg.id),
      ),
      withErrorContext(
        "INFRASTRUCTURE",
        "create primary org default location",
        () => createDefaultLocation(primaryOrg.id),
      ),

      // Secondary organization infrastructure
      withErrorContext(
        "INFRASTRUCTURE",
        "create secondary org priorities",
        () => createDefaultPriorities(secondaryOrg.id),
      ),
      withErrorContext(
        "INFRASTRUCTURE",
        "create secondary org collection types",
        () => createDefaultCollectionTypes(secondaryOrg.id),
      ),
      withErrorContext(
        "INFRASTRUCTURE",
        "create secondary org issue statuses",
        () => createDefaultIssueStatuses(secondaryOrg.id),
      ),
      withErrorContext(
        "INFRASTRUCTURE",
        "create secondary org default location",
        () => createDefaultLocation(secondaryOrg.id),
      ),
    ]);

    const dualSetup: DualOrganizationSetup = {
      primary: primaryOrg,
      secondary: secondaryOrg,
    };

    SeedLogger.success(`Infrastructure seeded for dual organizations`);
    return createSeedResult(dualSetup, 2, startTime);
  } catch (error) {
    SeedLogger.error("INFRASTRUCTURE", error);
    return createFailedSeedResult(error, startTime);
  }
}
