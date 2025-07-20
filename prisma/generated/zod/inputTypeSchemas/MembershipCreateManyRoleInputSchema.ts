import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const MembershipCreateManyRoleInputSchema: z.ZodType<Prisma.MembershipCreateManyRoleInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      userId: z.string(),
      organizationId: z.string(),
    })
    .strict() as z.ZodType<Prisma.MembershipCreateManyRoleInput>;

export default MembershipCreateManyRoleInputSchema;
