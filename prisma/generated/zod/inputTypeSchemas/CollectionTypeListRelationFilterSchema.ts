import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CollectionTypeWhereInputSchema } from "./CollectionTypeWhereInputSchema";

export const CollectionTypeListRelationFilterSchema: z.ZodType<Prisma.CollectionTypeListRelationFilter> =
  z
    .object({
      every: z.lazy(() => CollectionTypeWhereInputSchema).optional(),
      some: z.lazy(() => CollectionTypeWhereInputSchema).optional(),
      none: z.lazy(() => CollectionTypeWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionTypeListRelationFilter>;

export default CollectionTypeListRelationFilterSchema;
