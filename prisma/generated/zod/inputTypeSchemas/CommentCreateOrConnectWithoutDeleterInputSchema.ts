import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CommentWhereUniqueInputSchema } from './CommentWhereUniqueInputSchema';
import { CommentCreateWithoutDeleterInputSchema } from './CommentCreateWithoutDeleterInputSchema';
import { CommentUncheckedCreateWithoutDeleterInputSchema } from './CommentUncheckedCreateWithoutDeleterInputSchema';

export const CommentCreateOrConnectWithoutDeleterInputSchema: z.ZodType<Prisma.CommentCreateOrConnectWithoutDeleterInput> = z.object({
  where: z.lazy(() => CommentWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => CommentCreateWithoutDeleterInputSchema),z.lazy(() => CommentUncheckedCreateWithoutDeleterInputSchema) ]),
}).strict();

export default CommentCreateOrConnectWithoutDeleterInputSchema;
