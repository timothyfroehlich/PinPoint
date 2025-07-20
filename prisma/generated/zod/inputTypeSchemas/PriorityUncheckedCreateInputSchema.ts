import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueUncheckedCreateNestedManyWithoutPriorityInputSchema } from "./IssueUncheckedCreateNestedManyWithoutPriorityInputSchema";

export const PriorityUncheckedCreateInputSchema: z.ZodType<Prisma.PriorityUncheckedCreateInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      order: z.number().int(),
      organizationId: z.string(),
      isDefault: z.boolean().optional(),
      issues: z
        .lazy(() => IssueUncheckedCreateNestedManyWithoutPriorityInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.PriorityUncheckedCreateInput>;

export default PriorityUncheckedCreateInputSchema;
