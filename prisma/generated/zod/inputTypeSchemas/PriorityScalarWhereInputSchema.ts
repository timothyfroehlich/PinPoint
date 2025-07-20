import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFilterSchema } from './StringFilterSchema';
import { IntFilterSchema } from './IntFilterSchema';
import { BoolFilterSchema } from './BoolFilterSchema';

export const PriorityScalarWhereInputSchema: z.ZodType<Prisma.PriorityScalarWhereInput> = z.object({
  AND: z.union([ z.lazy(() => PriorityScalarWhereInputSchema),z.lazy(() => PriorityScalarWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => PriorityScalarWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => PriorityScalarWhereInputSchema),z.lazy(() => PriorityScalarWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  order: z.union([ z.lazy(() => IntFilterSchema),z.number() ]).optional(),
  organizationId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  isDefault: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
}).strict();

export default PriorityScalarWhereInputSchema;
