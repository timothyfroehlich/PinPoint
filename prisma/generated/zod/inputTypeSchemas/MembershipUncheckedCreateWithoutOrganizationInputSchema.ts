import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const MembershipUncheckedCreateWithoutOrganizationInputSchema: z.ZodType<Prisma.MembershipUncheckedCreateWithoutOrganizationInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      userId: z.string(),
      roleId: z.string(),
    })
    .strict() as z.ZodType<Prisma.MembershipUncheckedCreateWithoutOrganizationInput>;

export default MembershipUncheckedCreateWithoutOrganizationInputSchema;
