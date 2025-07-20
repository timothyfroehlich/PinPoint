import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFilterSchema } from './StringFilterSchema';
import { DateTimeFilterSchema } from './DateTimeFilterSchema';

export const UpvoteScalarWhereInputSchema: z.ZodType<Prisma.UpvoteScalarWhereInput> = z.object({
  AND: z.union([ z.lazy(() => UpvoteScalarWhereInputSchema),z.lazy(() => UpvoteScalarWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => UpvoteScalarWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => UpvoteScalarWhereInputSchema),z.lazy(() => UpvoteScalarWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  issueId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  userId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
}).strict();

export default UpvoteScalarWhereInputSchema;
