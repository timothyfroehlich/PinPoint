import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CommentWhereUniqueInputSchema } from './CommentWhereUniqueInputSchema';
import { CommentCreateWithoutIssueInputSchema } from './CommentCreateWithoutIssueInputSchema';
import { CommentUncheckedCreateWithoutIssueInputSchema } from './CommentUncheckedCreateWithoutIssueInputSchema';

export const CommentCreateOrConnectWithoutIssueInputSchema: z.ZodType<Prisma.CommentCreateOrConnectWithoutIssueInput> = z.object({
  where: z.lazy(() => CommentWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => CommentCreateWithoutIssueInputSchema),z.lazy(() => CommentUncheckedCreateWithoutIssueInputSchema) ]),
}).strict();

export default CommentCreateOrConnectWithoutIssueInputSchema;
