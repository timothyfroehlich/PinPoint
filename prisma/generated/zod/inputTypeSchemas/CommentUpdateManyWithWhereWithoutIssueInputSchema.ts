import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CommentScalarWhereInputSchema } from './CommentScalarWhereInputSchema';
import { CommentUpdateManyMutationInputSchema } from './CommentUpdateManyMutationInputSchema';
import { CommentUncheckedUpdateManyWithoutIssueInputSchema } from './CommentUncheckedUpdateManyWithoutIssueInputSchema';

export const CommentUpdateManyWithWhereWithoutIssueInputSchema: z.ZodType<Prisma.CommentUpdateManyWithWhereWithoutIssueInput> = z.object({
  where: z.lazy(() => CommentScalarWhereInputSchema),
  data: z.union([ z.lazy(() => CommentUpdateManyMutationInputSchema),z.lazy(() => CommentUncheckedUpdateManyWithoutIssueInputSchema) ]),
}).strict();

export default CommentUpdateManyWithWhereWithoutIssueInputSchema;
