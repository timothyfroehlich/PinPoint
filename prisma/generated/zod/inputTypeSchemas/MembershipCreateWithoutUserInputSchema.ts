import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationCreateNestedOneWithoutMembershipsInputSchema } from "./OrganizationCreateNestedOneWithoutMembershipsInputSchema";
import { RoleCreateNestedOneWithoutMembershipsInputSchema } from "./RoleCreateNestedOneWithoutMembershipsInputSchema";

export const MembershipCreateWithoutUserInputSchema: z.ZodType<Prisma.MembershipCreateWithoutUserInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      organization: z.lazy(
        () => OrganizationCreateNestedOneWithoutMembershipsInputSchema,
      ),
      role: z.lazy(() => RoleCreateNestedOneWithoutMembershipsInputSchema),
    })
    .strict() as z.ZodType<Prisma.MembershipCreateWithoutUserInput>;

export default MembershipCreateWithoutUserInputSchema;
