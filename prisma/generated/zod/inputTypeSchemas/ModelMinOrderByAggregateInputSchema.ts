import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const ModelMinOrderByAggregateInputSchema: z.ZodType<Prisma.ModelMinOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  manufacturer: z.lazy(() => SortOrderSchema).optional(),
  year: z.lazy(() => SortOrderSchema).optional(),
  ipdbId: z.lazy(() => SortOrderSchema).optional(),
  opdbId: z.lazy(() => SortOrderSchema).optional(),
  machineType: z.lazy(() => SortOrderSchema).optional(),
  machineDisplay: z.lazy(() => SortOrderSchema).optional(),
  isActive: z.lazy(() => SortOrderSchema).optional(),
  ipdbLink: z.lazy(() => SortOrderSchema).optional(),
  opdbImgUrl: z.lazy(() => SortOrderSchema).optional(),
  kineticistUrl: z.lazy(() => SortOrderSchema).optional(),
  isCustom: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default ModelMinOrderByAggregateInputSchema;
