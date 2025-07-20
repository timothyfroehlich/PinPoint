import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CommentCreateManyAuthorInputSchema } from './CommentCreateManyAuthorInputSchema';

export const CommentCreateManyAuthorInputEnvelopeSchema: z.ZodType<Prisma.CommentCreateManyAuthorInputEnvelope> = z.object({
  data: z.union([ z.lazy(() => CommentCreateManyAuthorInputSchema),z.lazy(() => CommentCreateManyAuthorInputSchema).array() ]),
  skipDuplicates: z.boolean().optional()
}).strict();

export default CommentCreateManyAuthorInputEnvelopeSchema;
