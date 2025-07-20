import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const PinballMapConfigCountOrderByAggregateInputSchema: z.ZodType<Prisma.PinballMapConfigCountOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  organizationId: z.lazy(() => SortOrderSchema).optional(),
  apiEnabled: z.lazy(() => SortOrderSchema).optional(),
  apiKey: z.lazy(() => SortOrderSchema).optional(),
  autoSyncEnabled: z.lazy(() => SortOrderSchema).optional(),
  syncIntervalHours: z.lazy(() => SortOrderSchema).optional(),
  lastGlobalSync: z.lazy(() => SortOrderSchema).optional(),
  createMissingModels: z.lazy(() => SortOrderSchema).optional(),
  updateExistingData: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default PinballMapConfigCountOrderByAggregateInputSchema;
