import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { CollectionUpdateManyMutationInputSchema } from "../inputTypeSchemas/CollectionUpdateManyMutationInputSchema";
import { CollectionUncheckedUpdateManyInputSchema } from "../inputTypeSchemas/CollectionUncheckedUpdateManyInputSchema";
import { CollectionWhereInputSchema } from "../inputTypeSchemas/CollectionWhereInputSchema";

export const CollectionUpdateManyArgsSchema: z.ZodType<Prisma.CollectionUpdateManyArgs> =
  z
    .object({
      data: z.union([
        CollectionUpdateManyMutationInputSchema,
        CollectionUncheckedUpdateManyInputSchema,
      ]),
      where: CollectionWhereInputSchema.optional(),
      limit: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionUpdateManyArgs>;

export default CollectionUpdateManyArgsSchema;
