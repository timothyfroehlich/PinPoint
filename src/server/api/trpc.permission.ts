import { TRPCError } from "@trpc/server";

import { organizationProcedure } from "./trpc.base";

import type { OrganizationTRPCContext } from "./trpc.base";

/**
 * Permission-based procedure factory
 *
 * Creates a procedure that requires a specific permission to be present in the user's role.
 * This replaces the old adminProcedure with a more granular permission system.
 */
export function requirePermission(permission: string): typeof organizationProcedure {
  return organizationProcedure.use(async ({ ctx, next }) => {
     
    if (!ctx.userPermissions.includes(permission)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Permission required: ${permission}`,
      });
    }

    return next({ 
      ctx: ctx satisfies OrganizationTRPCContext
    });
  });
}

// Specific permission procedures for common actions
export const issueCreateProcedure = requirePermission("issue:create");
export const issueEditProcedure = requirePermission("issue:edit");
export const issueDeleteProcedure = requirePermission("issue:delete");
export const issueAssignProcedure = requirePermission("issue:assign");
export const attachmentCreateProcedure = requirePermission("attachment:create");
export const attachmentDeleteProcedure = requirePermission("attachment:delete");
export const machineEditProcedure = requirePermission("machine:edit");
export const machineDeleteProcedure = requirePermission("machine:delete");
export const locationEditProcedure = requirePermission("location:edit");
export const locationDeleteProcedure = requirePermission("location:delete");
export const organizationManageProcedure = requirePermission(
  "organization:manage",
);
export const roleManageProcedure = requirePermission("role:manage");
export const userManageProcedure = requirePermission("user:manage");

/**
 * @deprecated Use specific permission procedures instead
 * Legacy adminProcedure - kept for backward compatibility during migration
 */
export const adminProcedure = organizationManageProcedure;
