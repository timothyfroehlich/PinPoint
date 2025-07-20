import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CommentWhereUniqueInputSchema } from './CommentWhereUniqueInputSchema';
import { CommentUpdateWithoutIssueInputSchema } from './CommentUpdateWithoutIssueInputSchema';
import { CommentUncheckedUpdateWithoutIssueInputSchema } from './CommentUncheckedUpdateWithoutIssueInputSchema';
import { CommentCreateWithoutIssueInputSchema } from './CommentCreateWithoutIssueInputSchema';
import { CommentUncheckedCreateWithoutIssueInputSchema } from './CommentUncheckedCreateWithoutIssueInputSchema';

export const CommentUpsertWithWhereUniqueWithoutIssueInputSchema: z.ZodType<Prisma.CommentUpsertWithWhereUniqueWithoutIssueInput> = z.object({
  where: z.lazy(() => CommentWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => CommentUpdateWithoutIssueInputSchema),z.lazy(() => CommentUncheckedUpdateWithoutIssueInputSchema) ]),
  create: z.union([ z.lazy(() => CommentCreateWithoutIssueInputSchema),z.lazy(() => CommentUncheckedCreateWithoutIssueInputSchema) ]),
}).strict();

export default CommentUpsertWithWhereUniqueWithoutIssueInputSchema;
