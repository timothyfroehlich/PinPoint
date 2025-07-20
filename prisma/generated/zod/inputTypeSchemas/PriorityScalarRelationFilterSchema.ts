import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { PriorityWhereInputSchema } from './PriorityWhereInputSchema';

export const PriorityScalarRelationFilterSchema: z.ZodType<Prisma.PriorityScalarRelationFilter> = z.object({
  is: z.lazy(() => PriorityWhereInputSchema).optional(),
  isNot: z.lazy(() => PriorityWhereInputSchema).optional()
}).strict();

export default PriorityScalarRelationFilterSchema;
