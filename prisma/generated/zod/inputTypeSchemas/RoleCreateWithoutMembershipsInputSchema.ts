import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationCreateNestedOneWithoutRolesInputSchema } from "./OrganizationCreateNestedOneWithoutRolesInputSchema";
import { PermissionCreateNestedManyWithoutRolesInputSchema } from "./PermissionCreateNestedManyWithoutRolesInputSchema";

export const RoleCreateWithoutMembershipsInputSchema: z.ZodType<Prisma.RoleCreateWithoutMembershipsInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      isDefault: z.boolean().optional(),
      organization: z.lazy(
        () => OrganizationCreateNestedOneWithoutRolesInputSchema,
      ),
      permissions: z
        .lazy(() => PermissionCreateNestedManyWithoutRolesInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.RoleCreateWithoutMembershipsInput>;

export default RoleCreateWithoutMembershipsInputSchema;
