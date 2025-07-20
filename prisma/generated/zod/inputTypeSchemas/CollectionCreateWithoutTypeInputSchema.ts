import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NullableJsonNullValueInputSchema } from './NullableJsonNullValueInputSchema';
import { InputJsonValueSchema } from './InputJsonValueSchema';
import { LocationCreateNestedOneWithoutCollectionsInputSchema } from './LocationCreateNestedOneWithoutCollectionsInputSchema';
import { MachineCreateNestedManyWithoutCollectionsInputSchema } from './MachineCreateNestedManyWithoutCollectionsInputSchema';

export const CollectionCreateWithoutTypeInputSchema: z.ZodType<Prisma.CollectionCreateWithoutTypeInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  isSmart: z.boolean().optional(),
  isManual: z.boolean().optional(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  filterCriteria: z.union([ z.lazy(() => NullableJsonNullValueInputSchema),InputJsonValueSchema ]).optional(),
  location: z.lazy(() => LocationCreateNestedOneWithoutCollectionsInputSchema).optional(),
  machines: z.lazy(() => MachineCreateNestedManyWithoutCollectionsInputSchema).optional()
}).strict();

export default CollectionCreateWithoutTypeInputSchema;
