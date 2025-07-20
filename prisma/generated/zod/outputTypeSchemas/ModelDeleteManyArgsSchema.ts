import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ModelWhereInputSchema } from "../inputTypeSchemas/ModelWhereInputSchema";

export const ModelDeleteManyArgsSchema: z.ZodType<Prisma.ModelDeleteManyArgs> =
  z
    .object({
      where: ModelWhereInputSchema.optional(),
      limit: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.ModelDeleteManyArgs>;

export default ModelDeleteManyArgsSchema;
