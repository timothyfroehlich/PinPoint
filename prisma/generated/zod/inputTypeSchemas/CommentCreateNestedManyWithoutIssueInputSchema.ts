import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CommentCreateWithoutIssueInputSchema } from './CommentCreateWithoutIssueInputSchema';
import { CommentUncheckedCreateWithoutIssueInputSchema } from './CommentUncheckedCreateWithoutIssueInputSchema';
import { CommentCreateOrConnectWithoutIssueInputSchema } from './CommentCreateOrConnectWithoutIssueInputSchema';
import { CommentCreateManyIssueInputEnvelopeSchema } from './CommentCreateManyIssueInputEnvelopeSchema';
import { CommentWhereUniqueInputSchema } from './CommentWhereUniqueInputSchema';

export const CommentCreateNestedManyWithoutIssueInputSchema: z.ZodType<Prisma.CommentCreateNestedManyWithoutIssueInput> = z.object({
  create: z.union([ z.lazy(() => CommentCreateWithoutIssueInputSchema),z.lazy(() => CommentCreateWithoutIssueInputSchema).array(),z.lazy(() => CommentUncheckedCreateWithoutIssueInputSchema),z.lazy(() => CommentUncheckedCreateWithoutIssueInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => CommentCreateOrConnectWithoutIssueInputSchema),z.lazy(() => CommentCreateOrConnectWithoutIssueInputSchema).array() ]).optional(),
  createMany: z.lazy(() => CommentCreateManyIssueInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => CommentWhereUniqueInputSchema),z.lazy(() => CommentWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default CommentCreateNestedManyWithoutIssueInputSchema;
