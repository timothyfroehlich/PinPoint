/**
 * Infrastructure Seeding
 *
 * Shared seeding for organizations, permissions, roles, priorities, statuses.
 * Consolidates the common code from the old seed files.
 */

import { eq, and, inArray } from "drizzle-orm";

// Quiet mode for tests
const isTestMode = process.env.NODE_ENV === "test" || process.env.VITEST;
const log = (...args: unknown[]) => {
  if (!isTestMode) console.log(...args);
};

import { createDrizzleClient } from "~/server/db/drizzle";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
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
import {
  ALL_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  SYSTEM_ROLES,
  ROLE_TEMPLATES,
  UNAUTHENTICATED_PERMISSIONS,
} from "~/server/auth/permissions.constants";

const db = createDrizzleClient();

// Map permission names to static IDs
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

// Helper functions for deterministic ID generation
function getPriorityId(priorityName: string, orgId: string): string {
  const isPrimary = orgId === SEED_TEST_IDS.ORGANIZATIONS.primary;
  const suffix = isPrimary ? "PRIMARY" : "COMPETITOR";

  switch (priorityName) {
    case "Low":
      return SEED_TEST_IDS.PRIORITIES[
        `LOW_${suffix}` as keyof typeof SEED_TEST_IDS.PRIORITIES
      ];
    case "Medium":
      return SEED_TEST_IDS.PRIORITIES[
        `MEDIUM_${suffix}` as keyof typeof SEED_TEST_IDS.PRIORITIES
      ];
    case "High":
      return SEED_TEST_IDS.PRIORITIES[
        `HIGH_${suffix}` as keyof typeof SEED_TEST_IDS.PRIORITIES
      ];
    case "Critical":
      return SEED_TEST_IDS.PRIORITIES[
        `CRITICAL_${suffix}` as keyof typeof SEED_TEST_IDS.PRIORITIES
      ];
    default:
      throw new Error(`Unknown priority: ${priorityName}`);
  }
}

function getStatusId(statusName: string, orgId: string): string {
  const isPrimary = orgId === SEED_TEST_IDS.ORGANIZATIONS.primary;
  const suffix = isPrimary ? "PRIMARY" : "COMPETITOR";

  switch (statusName) {
    case "New":
      return SEED_TEST_IDS.STATUSES[
        `NEW_${suffix}` as keyof typeof SEED_TEST_IDS.STATUSES
      ];
    case "In Progress":
      return SEED_TEST_IDS.STATUSES[
        `IN_PROGRESS_${suffix}` as keyof typeof SEED_TEST_IDS.STATUSES
      ];
    case "Needs expert help":
      return SEED_TEST_IDS.STATUSES[
        `NEEDS_EXPERT_${suffix}` as keyof typeof SEED_TEST_IDS.STATUSES
      ];
    case "Needs Parts":
      return SEED_TEST_IDS.STATUSES[
        `NEEDS_PARTS_${suffix}` as keyof typeof SEED_TEST_IDS.STATUSES
      ];
    case "Fixed":
      return SEED_TEST_IDS.STATUSES[
        `FIXED_${suffix}` as keyof typeof SEED_TEST_IDS.STATUSES
      ];
    case "Not to be Fixed":
      return SEED_TEST_IDS.STATUSES[
        `NOT_TO_BE_FIXED_${suffix}` as keyof typeof SEED_TEST_IDS.STATUSES
      ];
    case "Not Reproducible":
      return SEED_TEST_IDS.STATUSES[
        `NOT_REPRODUCIBLE_${suffix}` as keyof typeof SEED_TEST_IDS.STATUSES
      ];
    default:
      throw new Error(`Unknown status: ${statusName}`);
  }
}

function getRoleId(roleName: string, orgId: string): string {
  const isPrimary = orgId === SEED_TEST_IDS.ORGANIZATIONS.primary;
  const suffix = isPrimary ? "PRIMARY" : "COMPETITOR";

  switch (roleName) {
    case "Admin":
      return SEED_TEST_IDS.ROLES[
        `ADMIN_${suffix}` as keyof typeof SEED_TEST_IDS.ROLES
      ];
    case "Member":
      return SEED_TEST_IDS.ROLES[
        `MEMBER_${suffix}` as keyof typeof SEED_TEST_IDS.ROLES
      ];
    case "Unauthenticated":
      return SEED_TEST_IDS.ROLES[
        `UNAUTHENTICATED_${suffix}` as keyof typeof SEED_TEST_IDS.ROLES
      ];
    default:
      throw new Error(`Unknown role: ${roleName}`);
  }
}

function getCollectionTypeId(typeName: string, orgId: string): string {
  const isPrimary = orgId === SEED_TEST_IDS.ORGANIZATIONS.primary;
  const suffix = isPrimary ? "PRIMARY" : "COMPETITOR";

  switch (typeName) {
    case "Rooms":
      return SEED_TEST_IDS.COLLECTION_TYPES[
        `ROOMS_${suffix}` as keyof typeof SEED_TEST_IDS.COLLECTION_TYPES
      ];
    case "Manufacturer":
      return SEED_TEST_IDS.COLLECTION_TYPES[
        `MANUFACTURER_${suffix}` as keyof typeof SEED_TEST_IDS.COLLECTION_TYPES
      ];
    case "Era":
      return SEED_TEST_IDS.COLLECTION_TYPES[
        `ERA_${suffix}` as keyof typeof SEED_TEST_IDS.COLLECTION_TYPES
      ];
    default:
      throw new Error(`Unknown collection type: ${typeName}`);
  }
}

function getDefaultLocationId(orgId: string): string {
  const isPrimary = orgId === SEED_TEST_IDS.ORGANIZATIONS.primary;
  return isPrimary
    ? SEED_TEST_IDS.LOCATIONS.DEFAULT_PRIMARY
    : SEED_TEST_IDS.LOCATIONS.DEFAULT_COMPETITOR;
}

export interface Organization {
  id: string;
  name: string;
  subdomain: string;
}

export interface DualOrganizationSetup {
  primary: Organization;
  secondary: Organization;
}

/**
 * Create global permissions with provided database instance
 */
async function createGlobalPermissionsWithDb(
  dbInstance: typeof db,
): Promise<void> {
  // Get all existing permissions in one query
  const existingPermissions = await dbInstance
    .select({ name: permissions.name })
    .from(permissions);

  const existingSet = new Set(existingPermissions.map((p) => p.name));

  // Find permissions that need to be created
  const permissionsToCreate = ALL_PERMISSIONS.filter(
    (permName) => !existingSet.has(permName),
  ).map((permName) => ({
    id:
      PERMISSION_ID_MAP[permName] ||
      `perm-fallback-${permName.replace(/[^a-z0-9]/gi, "-")}`,
    name: permName,
    description: PERMISSION_DESCRIPTIONS[permName] ?? `Permission: ${permName}`,
  }));

  // Batch create all missing permissions
  if (permissionsToCreate.length > 0) {
    try {
      await dbInstance.insert(permissions).values(permissionsToCreate);
      log(
        `[INFRASTRUCTURE] Created ${permissionsToCreate.length.toString()} new permissions via batch insert`,
      );
    } catch (error) {
      console.error(
        `[INFRASTRUCTURE] ❌ Failed to batch create permissions:`,
        error,
      );
      throw new Error(
        `Permission creation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    log(
      `[INFRASTRUCTURE] All ${ALL_PERMISSIONS.length.toString()} permissions already exist`,
    );
  }
}

/**
 * Create organization with automatic default roles
 */

/**
 * Create organization with automatic default roles using provided database instance
 */
async function createOrganizationWithRolesWithDb(
  dbInstance: typeof db,
  orgData: {
    id?: string;
    name: string;
    subdomain: string;
    logoUrl?: string;
  },
): Promise<Organization> {
  // Check if organization exists
  const existing = await dbInstance
    .select()
    .from(organizations)
    .where(eq(organizations.subdomain, orgData.subdomain))
    .limit(1);

  let organization;
  if (existing.length > 0) {
    // Update existing organization
    const updated = await dbInstance
      .update(organizations)
      .set({
        name: orgData.name,
        logoUrl: orgData.logoUrl,
        updatedAt: new Date(),
      })
      .where(eq(organizations.subdomain, orgData.subdomain))
      .returning();
    organization =
      updated[0] ??
      (() => {
        throw new Error("Failed to update organization");
      })();
  } else {
    // Create new organization
    const created = await dbInstance
      .insert(organizations)
      .values({
        id: orgData.id ?? `org-fallback-${orgData.subdomain}`,
        name: orgData.name,
        subdomain: orgData.subdomain,
        logoUrl: orgData.logoUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    organization =
      created[0] ??
      (() => {
        throw new Error("Failed to create organization");
      })();
  }

  // Create system roles directly with Drizzle
  await createSystemRolesWithDb(dbInstance, organization.id);
  log(
    `[INFRASTRUCTURE] Created system roles for organization: ${organization.name}`,
  );

  // Create default Member role from template
  await createTemplateRoleWithDb(dbInstance, organization.id, "MEMBER");
  log(
    `[INFRASTRUCTURE] Created Member role template for organization: ${organization.name}`,
  );

  return {
    id: organization.id,
    name: organization.name,
    subdomain: organization.subdomain,
  };
}

/**
 * Create default priorities for organization with batch operations
 */

/**
 * Create default priorities with provided database instance
 */
async function createDefaultPrioritiesWithDb(
  dbInstance: typeof db,
  organizationId: string,
): Promise<void> {
  const priorityData = [
    { name: "Low", order: 1 },
    { name: "Medium", order: 2 },
    { name: "High", order: 3 },
    { name: "Critical", order: 4 },
  ];

  // Get existing priorities for this organization
  const existingPriorities = await dbInstance
    .select({ name: priorities.name })
    .from(priorities)
    .where(eq(priorities.organizationId, organizationId));

  const existingSet = new Set(existingPriorities.map((p) => p.name));

  // Find priorities that need to be created
  const prioritiesToCreate = priorityData
    .filter((priority) => !existingSet.has(priority.name))
    .map((priority) => ({
      id: getPriorityId(priority.name, organizationId),
      name: priority.name,
      order: priority.order,
      organizationId,
      isDefault: true,
    }));

  // Batch create all missing priorities
  if (prioritiesToCreate.length > 0) {
    try {
      await dbInstance.insert(priorities).values(prioritiesToCreate);
      log(
        `[INFRASTRUCTURE] Created ${prioritiesToCreate.length.toString()} new priorities via batch insert`,
      );
    } catch (error) {
      console.error(
        `[INFRASTRUCTURE] ❌ Failed to batch create priorities:`,
        error,
      );
      throw new Error(
        `Priority creation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    log(
      `[INFRASTRUCTURE] All ${priorityData.length.toString()} default priorities already exist`,
    );
  }
}

/**
 * Create default collection types with provided database instance
 */
async function createDefaultCollectionTypesWithDb(
  dbInstance: typeof db,
  organizationId: string,
): Promise<void> {
  const defaultCollectionTypes = [
    {
      name: "Rooms",
      displayName: "Rooms",
      isAutoGenerated: false,
      isEnabled: true,
      sortOrder: 1,
      sourceField: null,
    },
    {
      name: "Manufacturer",
      displayName: "Manufacturer",
      isAutoGenerated: true,
      sourceField: "manufacturer",
      isEnabled: false,
      sortOrder: 2,
    },
    {
      name: "Era",
      displayName: "Era",
      isAutoGenerated: true,
      sourceField: "year",
      isEnabled: false,
      sortOrder: 3,
    },
  ];

  // Get existing collection types for this organization
  const existingTypes = await dbInstance
    .select({ name: collectionTypes.name })
    .from(collectionTypes)
    .where(eq(collectionTypes.organizationId, organizationId));

  const existingSet = new Set(existingTypes.map((t) => t.name));

  // Separate types to create vs update
  const typesToCreate: typeof defaultCollectionTypes = [];
  const typesToUpdate: typeof defaultCollectionTypes = [];

  for (const typeData of defaultCollectionTypes) {
    if (existingSet.has(typeData.name)) {
      typesToUpdate.push(typeData);
    } else {
      typesToCreate.push(typeData);
    }
  }

  // Batch create new collection types
  if (typesToCreate.length > 0) {
    try {
      const createValues = typesToCreate.map((typeData) => ({
        id: getCollectionTypeId(typeData.name, organizationId),
        name: typeData.name,
        organizationId,
        displayName: typeData.displayName,
        isAutoGenerated: typeData.isAutoGenerated,
        isEnabled: typeData.isEnabled,
        sortOrder: typeData.sortOrder,
        sourceField: typeData.sourceField,
      }));

      await dbInstance.insert(collectionTypes).values(createValues);
      log(
        `[INFRASTRUCTURE] Created ${typesToCreate.length.toString()} new collection types via batch insert`,
      );
    } catch (error) {
      console.error(
        `[INFRASTRUCTURE] ❌ Failed to batch create collection types:`,
        error,
      );
      throw new Error(
        `Collection type creation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Update existing collection types (cannot easily batch updates with different WHERE clauses)
  for (const typeData of typesToUpdate) {
    try {
      await dbInstance
        .update(collectionTypes)
        .set({
          displayName: typeData.displayName,
          isAutoGenerated: typeData.isAutoGenerated,
          isEnabled: typeData.isEnabled,
          sortOrder: typeData.sortOrder,
          sourceField: typeData.sourceField,
        })
        .where(
          and(
            eq(collectionTypes.name, typeData.name),
            eq(collectionTypes.organizationId, organizationId),
          ),
        );
      log(`[INFRASTRUCTURE] Updated collection type: ${typeData.name}`);
    } catch (error) {
      console.error(
        `[INFRASTRUCTURE] ❌ Failed to update collection type ${typeData.name}:`,
        error,
      );
      throw new Error(
        `Collection type update failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (typesToCreate.length === 0 && typesToUpdate.length === 0) {
    log(
      `[INFRASTRUCTURE] All collection types already exist and are up to date`,
    );
  }
}

/**
 * Create default issue statuses for organization with batch operations
 */

/**
 * Create default issue statuses with provided database instance
 */
async function createDefaultStatusesWithDb(
  dbInstance: typeof db,
  organizationId: string,
): Promise<void> {
  const statusesToUpsert = [
    { name: "New", category: "NEW" as const },
    { name: "In Progress", category: "IN_PROGRESS" as const },
    { name: "Needs expert help", category: "IN_PROGRESS" as const },
    { name: "Needs Parts", category: "IN_PROGRESS" as const },
    { name: "Fixed", category: "RESOLVED" as const },
    { name: "Not to be Fixed", category: "RESOLVED" as const },
    { name: "Not Reproducible", category: "RESOLVED" as const },
  ];

  // Get existing issue statuses for this organization
  const existingStatuses = await dbInstance
    .select({ name: issueStatuses.name })
    .from(issueStatuses)
    .where(eq(issueStatuses.organizationId, organizationId));

  const existingSet = new Set(existingStatuses.map((s) => s.name));

  // Separate statuses to create vs update
  const statusesToCreate: typeof statusesToUpsert = [];
  const statusesToUpdate: typeof statusesToUpsert = [];

  for (const statusData of statusesToUpsert) {
    if (existingSet.has(statusData.name)) {
      statusesToUpdate.push(statusData);
    } else {
      statusesToCreate.push(statusData);
    }
  }

  // Batch create new issue statuses
  if (statusesToCreate.length > 0) {
    try {
      const createValues = statusesToCreate.map((statusData) => ({
        id: getStatusId(statusData.name, organizationId),
        name: statusData.name,
        category: statusData.category,
        organizationId,
        isDefault: true,
      }));

      await dbInstance.insert(issueStatuses).values(createValues);
      log(
        `[INFRASTRUCTURE] Created ${statusesToCreate.length.toString()} new issue statuses via batch insert`,
      );
    } catch (error) {
      console.error(
        `[INFRASTRUCTURE] ❌ Failed to batch create issue statuses:`,
        error,
      );
      throw new Error(
        `Issue status creation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Update existing issue statuses (cannot easily batch updates with different WHERE clauses)
  for (const statusData of statusesToUpdate) {
    try {
      await dbInstance
        .update(issueStatuses)
        .set({ category: statusData.category })
        .where(
          and(
            eq(issueStatuses.name, statusData.name),
            eq(issueStatuses.organizationId, organizationId),
          ),
        );
      log(`[INFRASTRUCTURE] Updated issue status: ${statusData.name}`);
    } catch (error) {
      console.error(
        `[INFRASTRUCTURE] ❌ Failed to update issue status ${statusData.name}:`,
        error,
      );
      throw new Error(
        `Issue status update failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (statusesToCreate.length === 0 && statusesToUpdate.length === 0) {
    log(`[INFRASTRUCTURE] All issue statuses already exist and are up to date`);
  }
}

/**
 * Create system roles for an organization
 */

/**
 * Create system roles with provided database instance
 */
async function createSystemRolesWithDb(
  dbInstance: typeof db,
  organizationId: string,
): Promise<void> {
  // Create Admin role
  const existingAdmin = await dbInstance
    .select()
    .from(roles)
    .where(
      and(
        eq(roles.name, SYSTEM_ROLES.ADMIN),
        eq(roles.organizationId, organizationId),
      ),
    )
    .limit(1);

  let adminRole;
  if (existingAdmin.length > 0) {
    // Update existing admin role
    const updated = await dbInstance
      .update(roles)
      .set({
        isSystem: true,
        isDefault: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(roles.name, SYSTEM_ROLES.ADMIN),
          eq(roles.organizationId, organizationId),
        ),
      )
      .returning();
    adminRole =
      updated[0] ??
      (() => {
        throw new Error("Failed to update admin role");
      })();
  } else {
    // Create new admin role
    const created = await dbInstance
      .insert(roles)
      .values({
        id: getRoleId(SYSTEM_ROLES.ADMIN, organizationId),
        name: SYSTEM_ROLES.ADMIN,
        organizationId,
        isSystem: true,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    adminRole =
      created[0] ??
      (() => {
        throw new Error("Failed to create admin role");
      })();
  }

  // Assign all permissions to admin role with batch operations
  const allPermissions = await dbInstance
    .select({ id: permissions.id })
    .from(permissions);

  // Clear existing permissions first
  await dbInstance
    .delete(rolePermissions)
    .where(eq(rolePermissions.roleId, adminRole.id));

  // Add all permissions in batch
  if (allPermissions.length > 0) {
    try {
      const rolePermissionValues = allPermissions.map((permission) => ({
        roleId: adminRole.id,
        permissionId: permission.id,
      }));

      await dbInstance.insert(rolePermissions).values(rolePermissionValues);
      log(
        `[INFRASTRUCTURE] Assigned ${allPermissions.length.toString()} permissions to Admin role via batch insert`,
      );
    } catch (error) {
      console.error(
        `[INFRASTRUCTURE] ❌ Failed to assign permissions to Admin role:`,
        error,
      );
      throw new Error(
        `Admin role permission assignment failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Create Unauthenticated role
  const existingUnauth = await dbInstance
    .select()
    .from(roles)
    .where(
      and(
        eq(roles.name, SYSTEM_ROLES.UNAUTHENTICATED),
        eq(roles.organizationId, organizationId),
      ),
    )
    .limit(1);

  let unauthRole;
  if (existingUnauth.length > 0) {
    // Update existing unauthenticated role
    const updated = await dbInstance
      .update(roles)
      .set({
        isSystem: true,
        isDefault: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(roles.name, SYSTEM_ROLES.UNAUTHENTICATED),
          eq(roles.organizationId, organizationId),
        ),
      )
      .returning();
    unauthRole =
      updated[0] ??
      (() => {
        throw new Error("Failed to update unauthenticated role");
      })();
  } else {
    // Create new unauthenticated role
    const created = await dbInstance
      .insert(roles)
      .values({
        id: getRoleId(SYSTEM_ROLES.UNAUTHENTICATED, organizationId),
        name: SYSTEM_ROLES.UNAUTHENTICATED,
        organizationId,
        isSystem: true,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    unauthRole =
      created[0] ??
      (() => {
        throw new Error("Failed to create unauthenticated role");
      })();
  }

  // Assign unauthenticated permissions with batch operations
  const unauthPermissions = await dbInstance
    .select({ id: permissions.id })
    .from(permissions)
    .where(inArray(permissions.name, UNAUTHENTICATED_PERMISSIONS));

  // Clear existing permissions first
  await dbInstance
    .delete(rolePermissions)
    .where(eq(rolePermissions.roleId, unauthRole.id));

  // Add unauthenticated permissions in batch
  if (unauthPermissions.length > 0) {
    try {
      const unauthRolePermissionValues = unauthPermissions.map(
        (permission) => ({
          roleId: unauthRole.id,
          permissionId: permission.id,
        }),
      );

      await dbInstance
        .insert(rolePermissions)
        .values(unauthRolePermissionValues);
      log(
        `[INFRASTRUCTURE] Assigned ${unauthPermissions.length.toString()} permissions to Unauthenticated role via batch insert`,
      );
    } catch (error) {
      console.error(
        `[INFRASTRUCTURE] ❌ Failed to assign permissions to Unauthenticated role:`,
        error,
      );
      throw new Error(
        `Unauthenticated role permission assignment failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Create a role from a template with provided database instance
 */
async function createTemplateRoleWithDb(
  dbInstance: typeof db,
  organizationId: string,
  templateName: keyof typeof ROLE_TEMPLATES,
): Promise<void> {
  const template = ROLE_TEMPLATES[templateName];

  // Check if role exists
  const existing = await dbInstance
    .select()
    .from(roles)
    .where(
      and(
        eq(roles.name, template.name),
        eq(roles.organizationId, organizationId),
      ),
    )
    .limit(1);

  let role;
  if (existing.length > 0) {
    // Update existing role
    const updated = await dbInstance
      .update(roles)
      .set({
        isSystem: false,
        isDefault: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(roles.name, template.name),
          eq(roles.organizationId, organizationId),
        ),
      )
      .returning();
    role =
      updated[0] ??
      (() => {
        throw new Error(`Failed to update ${template.name} role`);
      })();
  } else {
    // Create new role
    const created = await dbInstance
      .insert(roles)
      .values({
        id: getRoleId(template.name, organizationId),
        name: template.name,
        organizationId,
        isSystem: false,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    role =
      created[0] ??
      (() => {
        throw new Error(`Failed to create ${template.name} role`);
      })();
  }

  // Get template permissions with batch operations
  const templatePermissions = await dbInstance
    .select({ id: permissions.id })
    .from(permissions)
    .where(inArray(permissions.name, template.permissions));

  // Clear existing permissions first
  await dbInstance
    .delete(rolePermissions)
    .where(eq(rolePermissions.roleId, role.id));

  // Add template permissions in batch (simplified - in real implementation would expand dependencies)
  if (templatePermissions.length > 0) {
    try {
      const templateRolePermissionValues = templatePermissions.map(
        (permission) => ({
          roleId: role.id,
          permissionId: permission.id,
        }),
      );

      await dbInstance
        .insert(rolePermissions)
        .values(templateRolePermissionValues);
      log(
        `[INFRASTRUCTURE] Assigned ${templatePermissions.length.toString()} permissions to ${template.name} role via batch insert`,
      );
    } catch (error) {
      console.error(
        `[INFRASTRUCTURE] ❌ Failed to assign permissions to ${template.name} role:`,
        error,
      );
      throw new Error(
        `Template role permission assignment failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Create default location for organization
 */

/**
 * Create default location with provided database instance
 */
async function createDefaultLocationWithDb(
  dbInstance: typeof db,
  organizationId: string,
): Promise<void> {
  // Check if location exists
  const existing = await dbInstance
    .select()
    .from(locations)
    .where(
      and(
        eq(locations.name, "Austin Pinball Collective"),
        eq(locations.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    // Create new location
    await dbInstance.insert(locations).values({
      id: getDefaultLocationId(organizationId),
      name: "Austin Pinball Collective",
      street: "8777 Research Blvd",
      city: "Austin",
      state: "TX",
      zip: "78758",
      organizationId,
    });
    log("[INFRASTRUCTURE] Created default location: Austin Pinball Collective");
  } else {
    log(
      "[INFRASTRUCTURE] Default location already exists: Austin Pinball Collective",
    );
  }
}

/**
 * Create test database roles for dual-track testing
 * Only creates roles in test environments for safety
 */
async function createTestDatabaseRolesWithDb(
  dbInstance: typeof db,
): Promise<void> {
  // Only create test roles in test environments
  const nodeEnv = process.env.NODE_ENV;
  const isTestEnv = nodeEnv === "test" || process.env.VITEST;

  if (!isTestEnv) {
    log(
      "[INFRASTRUCTURE] Skipping test roles creation (not in test environment)",
    );
    return;
  }

  log("[INFRASTRUCTURE] Creating test database roles...");

  // Check and create integration_tester role (Track 2: Business Logic Testing)
  const integrationTesterExists = await dbInstance
    .execute(
      `
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'integration_tester'
  `,
    )
    .then((result) => result.length > 0)
    .catch(() => false);

  if (!integrationTesterExists) {
    try {
      await dbInstance.execute(`
        CREATE ROLE integration_tester WITH LOGIN BYPASSRLS PASSWORD 'testpassword'
      `);
      log(
        "[INFRASTRUCTURE] Created integration_tester role for business logic testing",
      );
    } catch (error) {
      // Role creation might fail if not superuser - that's okay, tests can still run
      log(
        "[INFRASTRUCTURE] Could not create integration_tester role (may require superuser)",
      );
    }
  } else {
    log("[INFRASTRUCTURE] integration_tester role already exists");
  }

  // authenticated and anon roles are typically created by Supabase
  // but we'll ensure they exist for completeness
  const authenticatedExists = await dbInstance
    .execute(
      `
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated'
  `,
    )
    .then((result) => result.length > 0)
    .catch(() => false);

  if (!authenticatedExists) {
    try {
      await dbInstance.execute(`CREATE ROLE authenticated`);
      log("[INFRASTRUCTURE] Created authenticated role for RLS testing");
    } catch (error) {
      log(
        "[INFRASTRUCTURE] Could not create authenticated role (may already exist in Supabase)",
      );
    }
  }

  const anonExists = await dbInstance
    .execute(
      `
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon'
  `,
    )
    .then((result) => result.length > 0)
    .catch(() => false);

  if (!anonExists) {
    try {
      await dbInstance.execute(`CREATE ROLE anon`);
      log("[INFRASTRUCTURE] Created anon role for anonymous testing");
    } catch (error) {
      log(
        "[INFRASTRUCTURE] Could not create anon role (may already exist in Supabase)",
      );
    }
  }

  // Grant necessary permissions for test roles
  try {
    await dbInstance.execute(`
      GRANT USAGE ON SCHEMA public TO integration_tester, authenticated, anon;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO integration_tester;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO integration_tester;
      GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO integration_tester;
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated, anon;
      GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
      GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    `);
    log("[INFRASTRUCTURE] Granted permissions to test roles");
  } catch (error) {
    log(
      "[INFRASTRUCTURE] Could not grant all permissions to test roles (may require superuser)",
    );
  }

  log("[INFRASTRUCTURE] ✅ Test database roles setup complete");
}

/**
 * Main infrastructure seeding function
 */
export async function seedInfrastructure(): Promise<DualOrganizationSetup> {
  return await seedInfrastructureWithDb(db);
}

/**
 * Infrastructure seeding function that accepts a database instance
 * This enables usage with PGlite for testing while maintaining production functionality
 */
export async function seedInfrastructureWithDb(
  dbInstance: typeof db,
): Promise<DualOrganizationSetup> {
  const startTime = Date.now();
  log("[INFRASTRUCTURE] Creating organizations, permissions, roles...");

  // 1. Create global permissions first
  await createGlobalPermissionsWithDb(dbInstance);

  // 2. Create both organizations with roles in parallel
  const [primaryOrg, secondaryOrg] = await Promise.all([
    createOrganizationWithRolesWithDb(dbInstance, {
      id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      name: "Austin Pinball Collective",
      subdomain: "apc",
      logoUrl:
        "/supabase/storage/pinpoint-storage-main/austinpinballcollective-logo-outline.png",
    }),
    createOrganizationWithRolesWithDb(dbInstance, {
      id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
      name: "Competitor Arcade",
      subdomain: "competitor",
      logoUrl: "/supabase/storage/pinpoint-storage-main/competitor-logo.png",
    }),
  ]);
  log(
    `[INFRASTRUCTURE] Created organizations: ${primaryOrg.name}, ${secondaryOrg.name}`,
  );

  // 3. Create test database roles (only in test environments)
  await createTestDatabaseRolesWithDb(dbInstance);

  // 4-7. Create organization-specific data for both orgs in parallel
  log(`[INFRASTRUCTURE] Creating organization data for both organizations...`);
  await Promise.all([
    // Primary organization data
    createDefaultPrioritiesWithDb(dbInstance, primaryOrg.id),
    createDefaultCollectionTypesWithDb(dbInstance, primaryOrg.id),
    createDefaultStatusesWithDb(dbInstance, primaryOrg.id),
    createDefaultLocationWithDb(dbInstance, primaryOrg.id),

    // Secondary organization data
    createDefaultPrioritiesWithDb(dbInstance, secondaryOrg.id),
    createDefaultCollectionTypesWithDb(dbInstance, secondaryOrg.id),
    createDefaultStatusesWithDb(dbInstance, secondaryOrg.id),
    createDefaultLocationWithDb(dbInstance, secondaryOrg.id),
  ]);

  const duration = Date.now() - startTime;
  log(
    `[INFRASTRUCTURE] ✅ Infrastructure seeding complete for both organizations in ${duration}ms`,
  );

  return {
    primary: {
      id: primaryOrg.id,
      name: primaryOrg.name,
      subdomain: primaryOrg.subdomain,
    },
    secondary: {
      id: secondaryOrg.id,
      name: secondaryOrg.name,
      subdomain: secondaryOrg.subdomain,
    },
  };
}
