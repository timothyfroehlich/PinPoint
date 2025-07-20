import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationCreateNestedOneWithoutRolesInputSchema } from "./OrganizationCreateNestedOneWithoutRolesInputSchema";
import { MembershipCreateNestedManyWithoutRoleInputSchema } from "./MembershipCreateNestedManyWithoutRoleInputSchema";

export const RoleCreateWithoutPermissionsInputSchema: z.ZodType<Prisma.RoleCreateWithoutPermissionsInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      isDefault: z.boolean().optional(),
      organization: z.lazy(
        () => OrganizationCreateNestedOneWithoutRolesInputSchema,
      ),
      memberships: z
        .lazy(() => MembershipCreateNestedManyWithoutRoleInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.RoleCreateWithoutPermissionsInput>;

export default RoleCreateWithoutPermissionsInputSchema;
