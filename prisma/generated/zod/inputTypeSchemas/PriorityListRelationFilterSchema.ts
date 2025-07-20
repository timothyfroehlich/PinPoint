import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { PriorityWhereInputSchema } from './PriorityWhereInputSchema';

export const PriorityListRelationFilterSchema: z.ZodType<Prisma.PriorityListRelationFilter> = z.object({
  every: z.lazy(() => PriorityWhereInputSchema).optional(),
  some: z.lazy(() => PriorityWhereInputSchema).optional(),
  none: z.lazy(() => PriorityWhereInputSchema).optional()
}).strict();

export default PriorityListRelationFilterSchema;
