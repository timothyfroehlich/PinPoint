import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const PriorityCountOutputTypeSelectSchema: z.ZodType<Prisma.PriorityCountOutputTypeSelect> =
  z
    .object({
      issues: z.boolean().optional(),
    })
    .strict();

export default PriorityCountOutputTypeSelectSchema;
