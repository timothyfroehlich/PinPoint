import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { PinballMapConfigWhereInputSchema } from './PinballMapConfigWhereInputSchema';

export const PinballMapConfigNullableScalarRelationFilterSchema: z.ZodType<Prisma.PinballMapConfigNullableScalarRelationFilter> = z.object({
  is: z.lazy(() => PinballMapConfigWhereInputSchema).optional().nullable(),
  isNot: z.lazy(() => PinballMapConfigWhereInputSchema).optional().nullable()
}).strict();

export default PinballMapConfigNullableScalarRelationFilterSchema;
