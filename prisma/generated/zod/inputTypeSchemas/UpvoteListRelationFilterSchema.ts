import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UpvoteWhereInputSchema } from './UpvoteWhereInputSchema';

export const UpvoteListRelationFilterSchema: z.ZodType<Prisma.UpvoteListRelationFilter> = z.object({
  every: z.lazy(() => UpvoteWhereInputSchema).optional(),
  some: z.lazy(() => UpvoteWhereInputSchema).optional(),
  none: z.lazy(() => UpvoteWhereInputSchema).optional()
}).strict();

export default UpvoteListRelationFilterSchema;
