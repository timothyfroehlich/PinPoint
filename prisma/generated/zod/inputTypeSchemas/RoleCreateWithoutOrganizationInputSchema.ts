import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MembershipCreateNestedManyWithoutRoleInputSchema } from "./MembershipCreateNestedManyWithoutRoleInputSchema";
import { PermissionCreateNestedManyWithoutRolesInputSchema } from "./PermissionCreateNestedManyWithoutRolesInputSchema";

export const RoleCreateWithoutOrganizationInputSchema: z.ZodType<Prisma.RoleCreateWithoutOrganizationInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      isDefault: z.boolean().optional(),
      memberships: z
        .lazy(() => MembershipCreateNestedManyWithoutRoleInputSchema)
        .optional(),
      permissions: z
        .lazy(() => PermissionCreateNestedManyWithoutRolesInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.RoleCreateWithoutOrganizationInput>;

export default RoleCreateWithoutOrganizationInputSchema;
