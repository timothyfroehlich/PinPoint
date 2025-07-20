import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const LocationAvgOrderByAggregateInputSchema: z.ZodType<Prisma.LocationAvgOrderByAggregateInput> = z.object({
  latitude: z.lazy(() => SortOrderSchema).optional(),
  longitude: z.lazy(() => SortOrderSchema).optional(),
  pinballMapId: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default LocationAvgOrderByAggregateInputSchema;
