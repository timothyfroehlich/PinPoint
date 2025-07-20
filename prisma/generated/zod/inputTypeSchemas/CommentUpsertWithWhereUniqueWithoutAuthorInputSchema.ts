import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CommentWhereUniqueInputSchema } from './CommentWhereUniqueInputSchema';
import { CommentUpdateWithoutAuthorInputSchema } from './CommentUpdateWithoutAuthorInputSchema';
import { CommentUncheckedUpdateWithoutAuthorInputSchema } from './CommentUncheckedUpdateWithoutAuthorInputSchema';
import { CommentCreateWithoutAuthorInputSchema } from './CommentCreateWithoutAuthorInputSchema';
import { CommentUncheckedCreateWithoutAuthorInputSchema } from './CommentUncheckedCreateWithoutAuthorInputSchema';

export const CommentUpsertWithWhereUniqueWithoutAuthorInputSchema: z.ZodType<Prisma.CommentUpsertWithWhereUniqueWithoutAuthorInput> = z.object({
  where: z.lazy(() => CommentWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => CommentUpdateWithoutAuthorInputSchema),z.lazy(() => CommentUncheckedUpdateWithoutAuthorInputSchema) ]),
  create: z.union([ z.lazy(() => CommentCreateWithoutAuthorInputSchema),z.lazy(() => CommentUncheckedCreateWithoutAuthorInputSchema) ]),
}).strict();

export default CommentUpsertWithWhereUniqueWithoutAuthorInputSchema;
