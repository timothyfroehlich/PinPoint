import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NullableJsonNullValueInputSchema } from './NullableJsonNullValueInputSchema';
import { InputJsonValueSchema } from './InputJsonValueSchema';
import { CollectionTypeCreateNestedOneWithoutCollectionsInputSchema } from './CollectionTypeCreateNestedOneWithoutCollectionsInputSchema';
import { LocationCreateNestedOneWithoutCollectionsInputSchema } from './LocationCreateNestedOneWithoutCollectionsInputSchema';

export const CollectionCreateWithoutMachinesInputSchema: z.ZodType<Prisma.CollectionCreateWithoutMachinesInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  isSmart: z.boolean().optional(),
  isManual: z.boolean().optional(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  filterCriteria: z.union([ z.lazy(() => NullableJsonNullValueInputSchema),InputJsonValueSchema ]).optional(),
  type: z.lazy(() => CollectionTypeCreateNestedOneWithoutCollectionsInputSchema),
  location: z.lazy(() => LocationCreateNestedOneWithoutCollectionsInputSchema).optional()
}).strict();

export default CollectionCreateWithoutMachinesInputSchema;
