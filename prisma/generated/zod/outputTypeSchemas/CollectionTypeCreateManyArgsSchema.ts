import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { CollectionTypeCreateManyInputSchema } from "../inputTypeSchemas/CollectionTypeCreateManyInputSchema";

export const CollectionTypeCreateManyArgsSchema: z.ZodType<Prisma.CollectionTypeCreateManyArgs> =
  z
    .object({
      data: z.union([
        CollectionTypeCreateManyInputSchema,
        CollectionTypeCreateManyInputSchema.array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionTypeCreateManyArgs>;

export default CollectionTypeCreateManyArgsSchema;
