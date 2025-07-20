import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CommentScalarWhereInputSchema } from './CommentScalarWhereInputSchema';
import { CommentUpdateManyMutationInputSchema } from './CommentUpdateManyMutationInputSchema';
import { CommentUncheckedUpdateManyWithoutAuthorInputSchema } from './CommentUncheckedUpdateManyWithoutAuthorInputSchema';

export const CommentUpdateManyWithWhereWithoutAuthorInputSchema: z.ZodType<Prisma.CommentUpdateManyWithWhereWithoutAuthorInput> = z.object({
  where: z.lazy(() => CommentScalarWhereInputSchema),
  data: z.union([ z.lazy(() => CommentUpdateManyMutationInputSchema),z.lazy(() => CommentUncheckedUpdateManyWithoutAuthorInputSchema) ]),
}).strict();

export default CommentUpdateManyWithWhereWithoutAuthorInputSchema;
