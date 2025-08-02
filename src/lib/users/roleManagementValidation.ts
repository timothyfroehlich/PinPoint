/**
 * Pure role management validation functions
 * Extracted from admin.ts and role.ts tRPC procedures for better testability and performance
 *
 * Following the proven statusValidation.ts pattern for:
 * - 65x performance improvement through pure function testing
 * - Comprehensive business rule validation
 * - Type-safe readonly interfaces
 * - Zero side effects for reliable testing
 */

// =============================================================================
// TYPE DEFINITIONS - Based on actual Prisma types from admin.ts
// =============================================================================

export interface User {
  readonly id: string;
  readonly name: string | null;
  readonly email: string;
}

export interface Role {
  readonly id: string;
  readonly name: string;
  readonly organizationId: string;
  readonly isSystem: boolean;
  readonly isDefault: boolean;
}

export interface Membership {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly roleId: string;
  readonly user: User;
  readonly role: Role;
}

// =============================================================================
// VALIDATION INPUT INTERFACES
// =============================================================================

export interface RoleAssignmentInput {
  readonly userId: string;
  readonly roleId: string;
  readonly organizationId: string;
}

export interface UserRemovalInput {
  readonly userId: string;
  readonly organizationId: string;
}

export interface RoleReassignmentInput {
  readonly roleId: string;
  readonly reassignRoleId?: string;
  readonly organizationId: string;
}

export interface RoleManagementContext {
  readonly organizationId: string;
  readonly actorUserId: string;
  readonly userPermissions: readonly string[];
}

// =============================================================================
// VALIDATION RESULT INTERFACES
// =============================================================================

export interface RoleValidationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly requiresReassignment?: boolean;
  readonly affectedMemberCount?: number;
}

export interface AdminCountValidationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly currentAdminCount: number;
  readonly finalAdminCount: number;
  readonly wouldRemoveLastAdmin: boolean;
}

export interface RoleReassignmentValidationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly membersToReassign: number;
  readonly reassignmentValid: boolean;
}

// =============================================================================
// MAIN VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate role assignment to a user
 * Orchestrates all validation checks for role assignment operations
 */
export function validateRoleAssignment(
  input: RoleAssignmentInput,
  targetRole: Role,
  userMembership: Membership | null,
  allMemberships: readonly Membership[],
  context: RoleManagementContext,
): RoleValidationResult {
  // 1. Validate organization boundary
  const orgValidation = validateOrganizationBoundary(
    targetRole,
    context.organizationId,
  );
  if (!orgValidation.valid) {
    return orgValidation;
  }

  // 2. Validate user membership exists
  const membershipValidation = validateUserMembership(
    userMembership,
    input.organizationId,
  );
  if (!membershipValidation.valid) {
    return membershipValidation;
  }

  // userMembership is guaranteed to be non-null at this point due to validation above
  if (!userMembership) {
    return {
      valid: false,
      error: "User membership validation failed",
    };
  }

  // 3. Validate admin count preservation if changing from/to admin role
  const adminValidation = validateAdminCountPreservation(
    userMembership,
    targetRole,
    allMemberships,
  );
  if (!adminValidation.valid) {
    return {
      valid: false,
      error: adminValidation.error ?? "Admin count validation failed",
    };
  }

  // 4. Validate role assignment business rules
  const roleRulesValidation = validateRoleAssignmentRules(
    userMembership,
    targetRole,
    context,
  );
  if (!roleRulesValidation.valid) {
    return roleRulesValidation;
  }

  return { valid: true };
}

/**
 * Validate user removal from organization
 * Ensures removal won't violate admin count constraints
 */
export function validateUserRemoval(
  membership: Membership,
  allMemberships: readonly Membership[],
  context: RoleManagementContext,
): RoleValidationResult {
  // 1. Validate membership exists and belongs to organization
  const membershipValidation = validateUserMembership(
    membership,
    context.organizationId,
  );
  if (!membershipValidation.valid) {
    return membershipValidation;
  }

  // 2. Validate admin count preservation
  const adminValidation = validateAdminCountForRemoval(
    membership,
    allMemberships,
  );
  if (!adminValidation.valid) {
    return {
      valid: false,
      error: adminValidation.error ?? "Admin count validation failed",
    };
  }

  // 3. Validate business rules for user removal
  const removalRulesValidation = validateUserRemovalRules(membership, context);
  if (!removalRulesValidation.valid) {
    return removalRulesValidation;
  }

  return { valid: true };
}

/**
 * Validate role deletion with member reassignment
 * Handles complex validation for role deletion scenarios
 */
export function validateRoleReassignment(
  input: RoleReassignmentInput,
  roleToDelete: Role,
  reassignRole: Role | null,
  memberships: readonly Membership[],
  context: RoleManagementContext,
): RoleReassignmentValidationResult {
  // 1. Validate role deletion is allowed
  const deletionValidation = validateRoleDeletion(roleToDelete, context);
  if (!deletionValidation.valid) {
    return {
      valid: false,
      error: deletionValidation.error ?? "Role deletion validation failed",
      membersToReassign: memberships.length,
      reassignmentValid: false,
    };
  }

  // 2. If there are members, validate reassignment
  const memberCount = memberships.length;
  if (memberCount > 0) {
    if (!input.reassignRoleId || !reassignRole) {
      return {
        valid: false,
        error: "Must specify a role to reassign members to",
        membersToReassign: memberCount,
        reassignmentValid: false,
      };
    }

    // Validate reassignment role
    const reassignValidation = validateReassignmentRole(
      reassignRole,
      roleToDelete,
      context,
    );
    if (!reassignValidation.valid) {
      return {
        valid: false,
        error: reassignValidation.error ?? "Reassignment validation failed",
        membersToReassign: memberCount,
        reassignmentValid: false,
      };
    }
  }

  return {
    valid: true,
    membersToReassign: memberCount,
    reassignmentValid: memberCount === 0 || reassignRole !== null,
  };
}

// =============================================================================
// SPECIFIC VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate organization boundary constraints
 * Ensures roles belong to the correct organization
 */
export function validateOrganizationBoundary(
  role: Role,
  expectedOrganizationId: string,
): RoleValidationResult {
  if (role.organizationId !== expectedOrganizationId) {
    return {
      valid: false,
      error: "Role not found or does not belong to this organization",
    };
  }

  return { valid: true };
}

/**
 * Validate user membership exists and belongs to organization
 */
export function validateUserMembership(
  membership: Membership | null,
  organizationId: string,
): RoleValidationResult {
  if (!membership) {
    return {
      valid: false,
      error: "User is not a member of this organization",
    };
  }

  if (membership.organizationId !== organizationId) {
    return {
      valid: false,
      error: "User membership does not belong to this organization",
    };
  }

  return { valid: true };
}

/**
 * Validate admin count preservation for role assignments
 * Ensures we maintain at least one admin
 */
export function validateAdminCountPreservation(
  currentMembership: Membership,
  newRole: Role,
  allMemberships: readonly Membership[],
): AdminCountValidationResult {
  const adminCount = countAdmins(allMemberships);
  const isCurrentlyAdmin = currentMembership.role.name === "Admin";
  const willBeAdmin = newRole.name === "Admin";

  // If changing from admin to non-admin, check if they're the last admin
  if (isCurrentlyAdmin && !willBeAdmin && adminCount <= 1) {
    return {
      valid: false,
      error: "Cannot remove the last admin from the organization",
      currentAdminCount: adminCount,
      finalAdminCount: 0,
      wouldRemoveLastAdmin: true,
    };
  }

  return {
    valid: true,
    currentAdminCount: adminCount,
    finalAdminCount:
      willBeAdmin && !isCurrentlyAdmin
        ? adminCount + 1
        : !willBeAdmin && isCurrentlyAdmin
          ? adminCount - 1
          : adminCount,
    wouldRemoveLastAdmin: false,
  };
}

/**
 * Validate admin count for user removal
 * Ensures removal won't leave organization without admins
 */
export function validateAdminCountForRemoval(
  membership: Membership,
  allMemberships: readonly Membership[],
): AdminCountValidationResult {
  const adminCount = countAdmins(allMemberships);
  const isAdmin = membership.role.name === "Admin";

  if (isAdmin && adminCount <= 1) {
    return {
      valid: false,
      error: "Cannot remove the last admin from the organization",
      currentAdminCount: adminCount,
      finalAdminCount: 0,
      wouldRemoveLastAdmin: true,
    };
  }

  return {
    valid: true,
    currentAdminCount: adminCount,
    finalAdminCount: isAdmin ? adminCount - 1 : adminCount,
    wouldRemoveLastAdmin: false,
  };
}

/**
 * Validate role assignment business rules
 */
export function validateRoleAssignmentRules(
  currentMembership: Membership,
  newRole: Role,
  _context: RoleManagementContext,
): RoleValidationResult {
  // Check if it's a no-op (assigning same role)
  if (currentMembership.roleId === newRole.id) {
    return {
      valid: false,
      error: "User already has this role",
    };
  }

  // All other role assignments are currently allowed
  // Additional business rules can be added here as needed
  return { valid: true };
}

/**
 * Validate user removal business rules
 */
export function validateUserRemovalRules(
  _membership: Membership,
  _context: RoleManagementContext,
): RoleValidationResult {
  // Currently no additional business rules for user removal
  // Rules can be added here as needed (e.g., prevent removing users with active issues)
  return { valid: true };
}

/**
 * Validate role deletion is allowed
 */
export function validateRoleDeletion(
  role: Role,
  _context: RoleManagementContext,
): RoleValidationResult {
  // Cannot delete system roles
  if (role.isSystem) {
    return {
      valid: false,
      error: "System roles cannot be deleted",
    };
  }

  return { valid: true };
}

/**
 * Validate reassignment role is suitable
 */
export function validateReassignmentRole(
  reassignRole: Role,
  roleToDelete: Role,
  context: RoleManagementContext,
): RoleValidationResult {
  // Validate reassignment role belongs to organization
  const orgValidation = validateOrganizationBoundary(
    reassignRole,
    context.organizationId,
  );
  if (!orgValidation.valid) {
    return {
      valid: false,
      error: "Reassignment role not found",
    };
  }

  // Cannot reassign to the same role being deleted
  if (reassignRole.id === roleToDelete.id) {
    return {
      valid: false,
      error: "Cannot reassign members to the role being deleted",
    };
  }

  return { valid: true };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Count admin users in memberships
 */
export function countAdmins(memberships: readonly Membership[]): number {
  return memberships.filter((membership) => membership.role.name === "Admin")
    .length;
}

/**
 * Get admin members from memberships
 */
export function getAdminMembers(
  memberships: readonly Membership[],
): readonly Membership[] {
  return memberships.filter((membership) => membership.role.name === "Admin");
}

/**
 * Check if role change affects admin count
 */
export function isAdminRoleChange(
  currentRole: Role,
  newRole: Role,
): {
  readonly fromAdmin: boolean;
  readonly toAdmin: boolean;
  readonly affectsAdminCount: boolean;
} {
  const fromAdmin = currentRole.name === "Admin";
  const toAdmin = newRole.name === "Admin";

  return {
    fromAdmin,
    toAdmin,
    affectsAdminCount: fromAdmin !== toAdmin,
  };
}

/**
 * Get role assignment effects
 * Used to determine what additional processing is needed
 */
export function getRoleAssignmentEffects(
  currentMembership: Membership,
  newRole: Role,
  allMemberships: readonly Membership[],
): {
  readonly changesAdminCount: boolean;
  readonly requiresAdminValidation: boolean;
  readonly newAdminCount: number;
  readonly requiresActivityLog: boolean;
} {
  const adminChange = isAdminRoleChange(currentMembership.role, newRole);
  const currentAdminCount = countAdmins(allMemberships);

  return {
    changesAdminCount: adminChange.affectsAdminCount,
    requiresAdminValidation: adminChange.fromAdmin,
    newAdminCount:
      adminChange.toAdmin && !adminChange.fromAdmin
        ? currentAdminCount + 1
        : !adminChange.toAdmin && adminChange.fromAdmin
          ? currentAdminCount - 1
          : currentAdminCount,
    requiresActivityLog: currentMembership.roleId !== newRole.id,
  };
}

/**
 * Validate multiple role operations in batch
 * Useful for bulk operations that need to maintain admin count across multiple changes
 */
export function validateBatchRoleOperations(
  operations: readonly {
    readonly type: "assign" | "remove";
    readonly membership: Membership;
    readonly newRole?: Role;
  }[],
  allMemberships: readonly Membership[],
  _context: RoleManagementContext,
): RoleValidationResult {
  let simulatedMemberships = [...allMemberships];

  // Simulate all operations to check final admin count
  for (const operation of operations) {
    if (operation.type === "assign" && operation.newRole) {
      // Update the simulated membership with new role
      const index = simulatedMemberships.findIndex(
        (m) => m.id === operation.membership.id,
      );
      if (index >= 0) {
        simulatedMemberships = [
          ...simulatedMemberships.slice(0, index),
          {
            ...operation.membership,
            role: operation.newRole,
            roleId: operation.newRole.id,
          },
          ...simulatedMemberships.slice(index + 1),
        ];
      }
    } else if (operation.type === "remove") {
      // Remove the membership from simulation
      simulatedMemberships = simulatedMemberships.filter(
        (m) => m.id !== operation.membership.id,
      );
    }
  }

  // Check final admin count
  const finalAdminCount = countAdmins(simulatedMemberships);
  if (finalAdminCount === 0) {
    return {
      valid: false,
      error: "Batch operation would remove all admins from the organization",
    };
  }

  return { valid: true };
}
