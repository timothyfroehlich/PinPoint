import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { CollectionTypeCountOutputTypeSelectSchema } from "./CollectionTypeCountOutputTypeSelectSchema";

export const CollectionTypeCountOutputTypeArgsSchema: z.ZodType<Prisma.CollectionTypeCountOutputTypeDefaultArgs> =
  z
    .object({
      select: z.lazy(() => CollectionTypeCountOutputTypeSelectSchema).nullish(),
    })
    .strict();

export default CollectionTypeCountOutputTypeSelectSchema;
