import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const PriorityCreateManyInputSchema: z.ZodType<Prisma.PriorityCreateManyInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      order: z.number().int(),
      organizationId: z.string(),
      isDefault: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.PriorityCreateManyInput>;

export default PriorityCreateManyInputSchema;
