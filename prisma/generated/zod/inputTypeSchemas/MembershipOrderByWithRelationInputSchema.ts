import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { UserOrderByWithRelationInputSchema } from "./UserOrderByWithRelationInputSchema";
import { OrganizationOrderByWithRelationInputSchema } from "./OrganizationOrderByWithRelationInputSchema";
import { RoleOrderByWithRelationInputSchema } from "./RoleOrderByWithRelationInputSchema";

export const MembershipOrderByWithRelationInputSchema: z.ZodType<Prisma.MembershipOrderByWithRelationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      userId: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      roleId: z.lazy(() => SortOrderSchema).optional(),
      user: z.lazy(() => UserOrderByWithRelationInputSchema).optional(),
      organization: z
        .lazy(() => OrganizationOrderByWithRelationInputSchema)
        .optional(),
      role: z.lazy(() => RoleOrderByWithRelationInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.MembershipOrderByWithRelationInput>;

export default MembershipOrderByWithRelationInputSchema;
