/**
 * Infrastructure Seeding
 *
 * Shared seeding for organizations, permissions, roles, priorities, statuses.
 * Consolidates the common code from the old seed files.
 */

import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

import { createDrizzleClient } from "~/server/db/drizzle";
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

export interface Organization {
  id: string;
  name: string;
  subdomain: string;
}

/**
 * Create global permissions using the constants with batch operations
 */
async function createGlobalPermissions(): Promise<void> {
  // Get all existing permissions in one query
  const existingPermissions = await db
    .select({ name: permissions.name })
    .from(permissions);
  
  const existingSet = new Set(existingPermissions.map(p => p.name));
  
  // Find permissions that need to be created
  const permissionsToCreate = ALL_PERMISSIONS.filter(
    permName => !existingSet.has(permName)
  ).map(permName => ({
    id: nanoid(),
    name: permName,
    description: PERMISSION_DESCRIPTIONS[permName] ?? `Permission: ${permName}`,
  }));

  // Batch create all missing permissions
  if (permissionsToCreate.length > 0) {
    await db.insert(permissions).values(permissionsToCreate);
    console.log(
      `[INFRASTRUCTURE] Created ${permissionsToCreate.length.toString()} new permissions via batch insert`,
    );
  } else {
    console.log(
      `[INFRASTRUCTURE] All ${ALL_PERMISSIONS.length.toString()} permissions already exist`,
    );
  }
}

/**
 * Create organization with automatic default roles
 */
async function createOrganizationWithRoles(orgData: {
  name: string;
  subdomain: string;
  logoUrl?: string;
}): Promise<Organization> {
  // Check if organization exists
  const existing = await db
    .select()
    .from(organizations)
    .where(eq(organizations.subdomain, orgData.subdomain))
    .limit(1);

  let organization;
  if (existing.length > 0) {
    // Update existing organization
    const updated = await db
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
    const created = await db
      .insert(organizations)
      .values({
        id: nanoid(),
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
  await createSystemRoles(organization.id);
  console.log(
    `[INFRASTRUCTURE] Created system roles for organization: ${organization.name}`,
  );

  // Create default Member role from template
  await createTemplateRole(organization.id, "MEMBER");
  console.log(
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
async function createDefaultPriorities(organizationId: string): Promise<void> {
  const priorityData = [
    { name: "Low", order: 1 },
    { name: "Medium", order: 2 },
    { name: "High", order: 3 },
    { name: "Critical", order: 4 },
  ];

  // Get existing priorities for this organization
  const existingPriorities = await db
    .select({ name: priorities.name })
    .from(priorities)
    .where(eq(priorities.organizationId, organizationId));

  const existingSet = new Set(existingPriorities.map(p => p.name));

  // Find priorities that need to be created
  const prioritiesToCreate = priorityData.filter(
    priority => !existingSet.has(priority.name)
  ).map(priority => ({
    id: nanoid(),
    name: priority.name,
    order: priority.order,
    organizationId,
    isDefault: true,
  }));

  // Batch create all missing priorities
  if (prioritiesToCreate.length > 0) {
    await db.insert(priorities).values(prioritiesToCreate);
    console.log(
      `[INFRASTRUCTURE] Created ${prioritiesToCreate.length.toString()} new priorities via batch insert`,
    );
  } else {
    console.log(
      `[INFRASTRUCTURE] All ${priorityData.length.toString()} default priorities already exist`,
    );
  }
}

/**
 * Create default collection types for an organization with batch operations
 */
async function createDefaultCollectionTypes(
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
  const existingTypes = await db
    .select({ name: collectionTypes.name })
    .from(collectionTypes)
    .where(eq(collectionTypes.organizationId, organizationId));

  const existingSet = new Set(existingTypes.map(t => t.name));

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
    const createValues = typesToCreate.map(typeData => ({
      id: nanoid(),
      name: typeData.name,
      organizationId,
      displayName: typeData.displayName,
      isAutoGenerated: typeData.isAutoGenerated,
      isEnabled: typeData.isEnabled,
      sortOrder: typeData.sortOrder,
      sourceField: typeData.sourceField,
    }));

    await db.insert(collectionTypes).values(createValues);
    console.log(
      `[INFRASTRUCTURE] Created ${typesToCreate.length.toString()} new collection types via batch insert`,
    );
  }

  // Update existing collection types (cannot easily batch updates with different WHERE clauses)
  for (const typeData of typesToUpdate) {
    await db
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
    console.log(
      `[INFRASTRUCTURE] Updated collection type: ${typeData.name}`,
    );
  }

  if (typesToCreate.length === 0 && typesToUpdate.length === 0) {
    console.log(
      `[INFRASTRUCTURE] All collection types already exist and are up to date`,
    );
  }
}

/**
 * Create default issue statuses for organization with batch operations
 */
async function createDefaultStatuses(organizationId: string): Promise<void> {
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
  const existingStatuses = await db
    .select({ name: issueStatuses.name })
    .from(issueStatuses)
    .where(eq(issueStatuses.organizationId, organizationId));

  const existingSet = new Set(existingStatuses.map(s => s.name));

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
    const createValues = statusesToCreate.map(statusData => ({
      id: nanoid(),
      name: statusData.name,
      category: statusData.category,
      organizationId,
      isDefault: true,
    }));

    await db.insert(issueStatuses).values(createValues);
    console.log(
      `[INFRASTRUCTURE] Created ${statusesToCreate.length.toString()} new issue statuses via batch insert`,
    );
  }

  // Update existing issue statuses (cannot easily batch updates with different WHERE clauses)
  for (const statusData of statusesToUpdate) {
    await db
      .update(issueStatuses)
      .set({ category: statusData.category })
      .where(
        and(
          eq(issueStatuses.name, statusData.name),
          eq(issueStatuses.organizationId, organizationId),
        ),
      );
    console.log(`[INFRASTRUCTURE] Updated issue status: ${statusData.name}`);
  }

  if (statusesToCreate.length === 0 && statusesToUpdate.length === 0) {
    console.log(
      `[INFRASTRUCTURE] All issue statuses already exist and are up to date`,
    );
  }
}

/**
 * Create system roles for an organization
 */
async function createSystemRoles(organizationId: string): Promise<void> {
  // Create Admin role
  const existingAdmin = await db
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
    const updated = await db
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
    const created = await db
      .insert(roles)
      .values({
        id: nanoid(),
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
  const allPermissions = await db.select({ id: permissions.id }).from(permissions);

  // Clear existing permissions first
  await db
    .delete(rolePermissions)
    .where(eq(rolePermissions.roleId, adminRole.id));

  // Add all permissions in batch
  if (allPermissions.length > 0) {
    const rolePermissionValues = allPermissions.map((permission) => ({
      roleId: adminRole.id,
      permissionId: permission.id,
    }));
    
    await db.insert(rolePermissions).values(rolePermissionValues);
    console.log(
      `[INFRASTRUCTURE] Assigned ${allPermissions.length.toString()} permissions to Admin role via batch insert`,
    );
  }

  // Create Unauthenticated role
  const existingUnauth = await db
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
    const updated = await db
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
    const created = await db
      .insert(roles)
      .values({
        id: nanoid(),
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
  const unauthPermissions = await db
    .select({ id: permissions.id })
    .from(permissions)
    .where(
      eq(permissions.name, UNAUTHENTICATED_PERMISSIONS[0] ?? "issue:view"),
    );

  // Clear existing permissions first
  await db
    .delete(rolePermissions)
    .where(eq(rolePermissions.roleId, unauthRole.id));

  // Add unauthenticated permissions in batch
  if (unauthPermissions.length > 0) {
    const unauthRolePermissionValues = unauthPermissions.map((permission) => ({
      roleId: unauthRole.id,
      permissionId: permission.id,
    }));
    
    await db.insert(rolePermissions).values(unauthRolePermissionValues);
    console.log(
      `[INFRASTRUCTURE] Assigned ${unauthPermissions.length.toString()} permissions to Unauthenticated role via batch insert`,
    );
  }
}

/**
 * Create a role from a template
 */
async function createTemplateRole(
  organizationId: string,
  templateName: keyof typeof ROLE_TEMPLATES,
): Promise<void> {
  const template = ROLE_TEMPLATES[templateName];

  // Check if role exists
  const existing = await db
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
    const updated = await db
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
    const created = await db
      .insert(roles)
      .values({
        id: nanoid(),
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
  const templatePermissions = await db
    .select({ id: permissions.id })
    .from(permissions)
    .where(eq(permissions.name, template.permissions[0] ?? ""));

  // Clear existing permissions first
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));

  // Add template permissions in batch (simplified - in real implementation would expand dependencies)
  if (templatePermissions.length > 0) {
    const templateRolePermissionValues = templatePermissions.map((permission) => ({
      roleId: role.id,
      permissionId: permission.id,
    }));
    
    await db.insert(rolePermissions).values(templateRolePermissionValues);
    console.log(
      `[INFRASTRUCTURE] Assigned ${templatePermissions.length.toString()} permissions to ${template.name} role via batch insert`,
    );
  }
}

/**
 * Create default location for organization
 */
async function createDefaultLocation(organizationId: string): Promise<void> {
  // Check if location exists
  const existing = await db
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
    await db.insert(locations).values({
      id: nanoid(),
      name: "Austin Pinball Collective",
      street: "8777 Research Blvd",
      city: "Austin",
      state: "TX",
      zip: "78758",
      organizationId,
    });
    console.log(
      "[INFRASTRUCTURE] Created default location: Austin Pinball Collective",
    );
  } else {
    console.log(
      "[INFRASTRUCTURE] Default location already exists: Austin Pinball Collective",
    );
  }
}

/**
 * Main infrastructure seeding function
 */
export async function seedInfrastructure(): Promise<Organization> {
  const startTime = Date.now();
  console.log("[INFRASTRUCTURE] Creating organizations, permissions, roles...");

  // 1. Create global permissions first
  await createGlobalPermissions();

  // 2. Create organization with roles
  const organization = await createOrganizationWithRoles({
    name: "Austin Pinball Collective",
    subdomain: "apc",
    logoUrl: "/images/logos/austinpinballcollective-logo-outline.png",
  });
  console.log(`[INFRASTRUCTURE] Created organization: ${organization.name}`);

  // 3-6. Create organization-specific data in parallel where safe
  console.log(`[INFRASTRUCTURE] Creating organization data...`);
  await Promise.all([
    createDefaultPriorities(organization.id),
    createDefaultCollectionTypes(organization.id),
    createDefaultStatuses(organization.id),
    createDefaultLocation(organization.id)
  ]);

  const duration = Date.now() - startTime;
  console.log(
    `[INFRASTRUCTURE] ✅ Infrastructure seeding complete for ${organization.name} in ${duration}ms`,
  );

  return {
    id: organization.id,
    name: organization.name,
    subdomain: organization.subdomain,
  };
}
