import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionWhereInputSchema } from './CollectionWhereInputSchema';

export const CollectionListRelationFilterSchema: z.ZodType<Prisma.CollectionListRelationFilter> = z.object({
  every: z.lazy(() => CollectionWhereInputSchema).optional(),
  some: z.lazy(() => CollectionWhereInputSchema).optional(),
  none: z.lazy(() => CollectionWhereInputSchema).optional()
}).strict();

export default CollectionListRelationFilterSchema;
