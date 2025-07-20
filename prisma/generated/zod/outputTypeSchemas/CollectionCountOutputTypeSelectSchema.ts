import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const CollectionCountOutputTypeSelectSchema: z.ZodType<Prisma.CollectionCountOutputTypeSelect> =
  z
    .object({
      machines: z.boolean().optional(),
    })
    .strict();

export default CollectionCountOutputTypeSelectSchema;
