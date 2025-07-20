import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';
import { SortOrderInputSchema } from './SortOrderInputSchema';
import { ModelCountOrderByAggregateInputSchema } from './ModelCountOrderByAggregateInputSchema';
import { ModelAvgOrderByAggregateInputSchema } from './ModelAvgOrderByAggregateInputSchema';
import { ModelMaxOrderByAggregateInputSchema } from './ModelMaxOrderByAggregateInputSchema';
import { ModelMinOrderByAggregateInputSchema } from './ModelMinOrderByAggregateInputSchema';
import { ModelSumOrderByAggregateInputSchema } from './ModelSumOrderByAggregateInputSchema';

export const ModelOrderByWithAggregationInputSchema: z.ZodType<Prisma.ModelOrderByWithAggregationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  manufacturer: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  year: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  ipdbId: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  opdbId: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  machineType: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  machineDisplay: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  isActive: z.lazy(() => SortOrderSchema).optional(),
  ipdbLink: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  opdbImgUrl: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  kineticistUrl: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  isCustom: z.lazy(() => SortOrderSchema).optional(),
  _count: z.lazy(() => ModelCountOrderByAggregateInputSchema).optional(),
  _avg: z.lazy(() => ModelAvgOrderByAggregateInputSchema).optional(),
  _max: z.lazy(() => ModelMaxOrderByAggregateInputSchema).optional(),
  _min: z.lazy(() => ModelMinOrderByAggregateInputSchema).optional(),
  _sum: z.lazy(() => ModelSumOrderByAggregateInputSchema).optional()
}).strict();

export default ModelOrderByWithAggregationInputSchema;
