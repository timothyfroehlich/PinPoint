import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';
import { SortOrderInputSchema } from './SortOrderInputSchema';
import { CollectionTypeOrderByWithRelationInputSchema } from './CollectionTypeOrderByWithRelationInputSchema';
import { LocationOrderByWithRelationInputSchema } from './LocationOrderByWithRelationInputSchema';
import { MachineOrderByRelationAggregateInputSchema } from './MachineOrderByRelationAggregateInputSchema';

export const CollectionOrderByWithRelationInputSchema: z.ZodType<Prisma.CollectionOrderByWithRelationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  typeId: z.lazy(() => SortOrderSchema).optional(),
  locationId: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  isSmart: z.lazy(() => SortOrderSchema).optional(),
  isManual: z.lazy(() => SortOrderSchema).optional(),
  description: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  sortOrder: z.lazy(() => SortOrderSchema).optional(),
  filterCriteria: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  type: z.lazy(() => CollectionTypeOrderByWithRelationInputSchema).optional(),
  location: z.lazy(() => LocationOrderByWithRelationInputSchema).optional(),
  machines: z.lazy(() => MachineOrderByRelationAggregateInputSchema).optional()
}).strict();

export default CollectionOrderByWithRelationInputSchema;
