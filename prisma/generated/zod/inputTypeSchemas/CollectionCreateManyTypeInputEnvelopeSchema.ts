import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionCreateManyTypeInputSchema } from './CollectionCreateManyTypeInputSchema';

export const CollectionCreateManyTypeInputEnvelopeSchema: z.ZodType<Prisma.CollectionCreateManyTypeInputEnvelope> = z.object({
  data: z.union([ z.lazy(() => CollectionCreateManyTypeInputSchema),z.lazy(() => CollectionCreateManyTypeInputSchema).array() ]),
  skipDuplicates: z.boolean().optional()
}).strict();

export default CollectionCreateManyTypeInputEnvelopeSchema;
