import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const MembershipCreateManyUserInputSchema: z.ZodType<Prisma.MembershipCreateManyUserInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      organizationId: z.string(),
      roleId: z.string(),
    })
    .strict() as z.ZodType<Prisma.MembershipCreateManyUserInput>;

export default MembershipCreateManyUserInputSchema;
