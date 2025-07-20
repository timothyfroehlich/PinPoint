import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionTypeWhereInputSchema } from './CollectionTypeWhereInputSchema';

export const CollectionTypeScalarRelationFilterSchema: z.ZodType<Prisma.CollectionTypeScalarRelationFilter> = z.object({
  is: z.lazy(() => CollectionTypeWhereInputSchema).optional(),
  isNot: z.lazy(() => CollectionTypeWhereInputSchema).optional()
}).strict();

export default CollectionTypeScalarRelationFilterSchema;
