import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { PriorityWhereInputSchema } from "../inputTypeSchemas/PriorityWhereInputSchema";

export const PriorityDeleteManyArgsSchema: z.ZodType<Prisma.PriorityDeleteManyArgs> =
  z
    .object({
      where: PriorityWhereInputSchema.optional(),
      limit: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.PriorityDeleteManyArgs>;

export default PriorityDeleteManyArgsSchema;
