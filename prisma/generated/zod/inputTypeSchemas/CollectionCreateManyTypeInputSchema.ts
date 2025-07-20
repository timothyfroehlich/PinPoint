import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NullableJsonNullValueInputSchema } from './NullableJsonNullValueInputSchema';
import { InputJsonValueSchema } from './InputJsonValueSchema';

export const CollectionCreateManyTypeInputSchema: z.ZodType<Prisma.CollectionCreateManyTypeInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  locationId: z.string().optional().nullable(),
  isSmart: z.boolean().optional(),
  isManual: z.boolean().optional(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  filterCriteria: z.union([ z.lazy(() => NullableJsonNullValueInputSchema),InputJsonValueSchema ]).optional(),
}).strict();

export default CollectionCreateManyTypeInputSchema;
