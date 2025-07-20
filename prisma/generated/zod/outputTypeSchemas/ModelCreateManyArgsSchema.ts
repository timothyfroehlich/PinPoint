import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ModelCreateManyInputSchema } from "../inputTypeSchemas/ModelCreateManyInputSchema";

export const ModelCreateManyArgsSchema: z.ZodType<Prisma.ModelCreateManyArgs> =
  z
    .object({
      data: z.union([
        ModelCreateManyInputSchema,
        ModelCreateManyInputSchema.array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.ModelCreateManyArgs>;

export default ModelCreateManyArgsSchema;
