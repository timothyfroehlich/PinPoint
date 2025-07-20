import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PermissionUncheckedCreateNestedManyWithoutRolesInputSchema } from "./PermissionUncheckedCreateNestedManyWithoutRolesInputSchema";

export const RoleUncheckedCreateWithoutMembershipsInputSchema: z.ZodType<Prisma.RoleUncheckedCreateWithoutMembershipsInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      organizationId: z.string(),
      isDefault: z.boolean().optional(),
      permissions: z
        .lazy(() => PermissionUncheckedCreateNestedManyWithoutRolesInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.RoleUncheckedCreateWithoutMembershipsInput>;

export default RoleUncheckedCreateWithoutMembershipsInputSchema;
