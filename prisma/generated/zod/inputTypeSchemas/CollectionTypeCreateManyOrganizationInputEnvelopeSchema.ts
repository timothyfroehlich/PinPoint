import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionTypeCreateManyOrganizationInputSchema } from './CollectionTypeCreateManyOrganizationInputSchema';

export const CollectionTypeCreateManyOrganizationInputEnvelopeSchema: z.ZodType<Prisma.CollectionTypeCreateManyOrganizationInputEnvelope> = z.object({
  data: z.union([ z.lazy(() => CollectionTypeCreateManyOrganizationInputSchema),z.lazy(() => CollectionTypeCreateManyOrganizationInputSchema).array() ]),
  skipDuplicates: z.boolean().optional()
}).strict();

export default CollectionTypeCreateManyOrganizationInputEnvelopeSchema;
