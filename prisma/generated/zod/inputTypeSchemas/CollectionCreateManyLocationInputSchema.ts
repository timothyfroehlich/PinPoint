import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { NullableJsonNullValueInputSchema } from "./NullableJsonNullValueInputSchema";
import { InputJsonValueSchema } from "./InputJsonValueSchema";

export const CollectionCreateManyLocationInputSchema: z.ZodType<Prisma.CollectionCreateManyLocationInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      typeId: z.string(),
      isSmart: z.boolean().optional(),
      isManual: z.boolean().optional(),
      description: z.string().optional().nullable(),
      sortOrder: z.number().int().optional(),
      filterCriteria: z
        .union([
          z.lazy(() => NullableJsonNullValueInputSchema),
          InputJsonValueSchema,
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionCreateManyLocationInput>;

export default CollectionCreateManyLocationInputSchema;
