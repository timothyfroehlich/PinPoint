import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { CollectionTypeUpdateManyMutationInputSchema } from "../inputTypeSchemas/CollectionTypeUpdateManyMutationInputSchema";
import { CollectionTypeUncheckedUpdateManyInputSchema } from "../inputTypeSchemas/CollectionTypeUncheckedUpdateManyInputSchema";
import { CollectionTypeWhereInputSchema } from "../inputTypeSchemas/CollectionTypeWhereInputSchema";

export const CollectionTypeUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.CollectionTypeUpdateManyAndReturnArgs> =
  z
    .object({
      data: z.union([
        CollectionTypeUpdateManyMutationInputSchema,
        CollectionTypeUncheckedUpdateManyInputSchema,
      ]),
      where: CollectionTypeWhereInputSchema.optional(),
      limit: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionTypeUpdateManyAndReturnArgs>;

export default CollectionTypeUpdateManyAndReturnArgsSchema;
