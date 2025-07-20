import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CommentWhereUniqueInputSchema } from './CommentWhereUniqueInputSchema';
import { CommentUpdateWithoutDeleterInputSchema } from './CommentUpdateWithoutDeleterInputSchema';
import { CommentUncheckedUpdateWithoutDeleterInputSchema } from './CommentUncheckedUpdateWithoutDeleterInputSchema';

export const CommentUpdateWithWhereUniqueWithoutDeleterInputSchema: z.ZodType<Prisma.CommentUpdateWithWhereUniqueWithoutDeleterInput> = z.object({
  where: z.lazy(() => CommentWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => CommentUpdateWithoutDeleterInputSchema),z.lazy(() => CommentUncheckedUpdateWithoutDeleterInputSchema) ]),
}).strict();

export default CommentUpdateWithWhereUniqueWithoutDeleterInputSchema;
