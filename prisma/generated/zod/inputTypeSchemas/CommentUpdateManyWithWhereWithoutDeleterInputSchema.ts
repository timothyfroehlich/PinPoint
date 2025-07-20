import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CommentScalarWhereInputSchema } from './CommentScalarWhereInputSchema';
import { CommentUpdateManyMutationInputSchema } from './CommentUpdateManyMutationInputSchema';
import { CommentUncheckedUpdateManyWithoutDeleterInputSchema } from './CommentUncheckedUpdateManyWithoutDeleterInputSchema';

export const CommentUpdateManyWithWhereWithoutDeleterInputSchema: z.ZodType<Prisma.CommentUpdateManyWithWhereWithoutDeleterInput> = z.object({
  where: z.lazy(() => CommentScalarWhereInputSchema),
  data: z.union([ z.lazy(() => CommentUpdateManyMutationInputSchema),z.lazy(() => CommentUncheckedUpdateManyWithoutDeleterInputSchema) ]),
}).strict();

export default CommentUpdateManyWithWhereWithoutDeleterInputSchema;
