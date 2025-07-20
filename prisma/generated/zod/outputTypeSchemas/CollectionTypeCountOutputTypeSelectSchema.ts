import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const CollectionTypeCountOutputTypeSelectSchema: z.ZodType<Prisma.CollectionTypeCountOutputTypeSelect> =
  z
    .object({
      collections: z.boolean().optional(),
    })
    .strict();

export default CollectionTypeCountOutputTypeSelectSchema;
