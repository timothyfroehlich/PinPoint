import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MembershipUncheckedCreateNestedManyWithoutRoleInputSchema } from "./MembershipUncheckedCreateNestedManyWithoutRoleInputSchema";
import { PermissionUncheckedCreateNestedManyWithoutRolesInputSchema } from "./PermissionUncheckedCreateNestedManyWithoutRolesInputSchema";

export const RoleUncheckedCreateInputSchema: z.ZodType<Prisma.RoleUncheckedCreateInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      organizationId: z.string(),
      isDefault: z.boolean().optional(),
      memberships: z
        .lazy(() => MembershipUncheckedCreateNestedManyWithoutRoleInputSchema)
        .optional(),
      permissions: z
        .lazy(() => PermissionUncheckedCreateNestedManyWithoutRolesInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.RoleUncheckedCreateInput>;

export default RoleUncheckedCreateInputSchema;
