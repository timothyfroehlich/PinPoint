import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const PriorityNameOrganizationIdCompoundUniqueInputSchema: z.ZodType<Prisma.PriorityNameOrganizationIdCompoundUniqueInput> =
  z
    .object({
      name: z.string(),
      organizationId: z.string(),
    })
    .strict() as z.ZodType<Prisma.PriorityNameOrganizationIdCompoundUniqueInput>;

export default PriorityNameOrganizationIdCompoundUniqueInputSchema;
