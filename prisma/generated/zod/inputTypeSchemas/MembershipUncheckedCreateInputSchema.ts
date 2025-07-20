import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const MembershipUncheckedCreateInputSchema: z.ZodType<Prisma.MembershipUncheckedCreateInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      userId: z.string(),
      organizationId: z.string(),
      roleId: z.string(),
    })
    .strict() as z.ZodType<Prisma.MembershipUncheckedCreateInput>;

export default MembershipUncheckedCreateInputSchema;
