import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UserCreateNestedOneWithoutMembershipsInputSchema } from "./UserCreateNestedOneWithoutMembershipsInputSchema";
import { OrganizationCreateNestedOneWithoutMembershipsInputSchema } from "./OrganizationCreateNestedOneWithoutMembershipsInputSchema";

export const MembershipCreateWithoutRoleInputSchema: z.ZodType<Prisma.MembershipCreateWithoutRoleInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      user: z.lazy(() => UserCreateNestedOneWithoutMembershipsInputSchema),
      organization: z.lazy(
        () => OrganizationCreateNestedOneWithoutMembershipsInputSchema,
      ),
    })
    .strict() as z.ZodType<Prisma.MembershipCreateWithoutRoleInput>;

export default MembershipCreateWithoutRoleInputSchema;
