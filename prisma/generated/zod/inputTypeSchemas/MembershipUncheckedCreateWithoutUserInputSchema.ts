import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const MembershipUncheckedCreateWithoutUserInputSchema: z.ZodType<Prisma.MembershipUncheckedCreateWithoutUserInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      organizationId: z.string(),
      roleId: z.string(),
    })
    .strict() as z.ZodType<Prisma.MembershipUncheckedCreateWithoutUserInput>;

export default MembershipUncheckedCreateWithoutUserInputSchema;
