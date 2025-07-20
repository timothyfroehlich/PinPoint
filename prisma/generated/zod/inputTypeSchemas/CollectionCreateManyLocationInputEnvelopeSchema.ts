import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CollectionCreateManyLocationInputSchema } from "./CollectionCreateManyLocationInputSchema";

export const CollectionCreateManyLocationInputEnvelopeSchema: z.ZodType<Prisma.CollectionCreateManyLocationInputEnvelope> =
  z
    .object({
      data: z.union([
        z.lazy(() => CollectionCreateManyLocationInputSchema),
        z.lazy(() => CollectionCreateManyLocationInputSchema).array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionCreateManyLocationInputEnvelope>;

export default CollectionCreateManyLocationInputEnvelopeSchema;
