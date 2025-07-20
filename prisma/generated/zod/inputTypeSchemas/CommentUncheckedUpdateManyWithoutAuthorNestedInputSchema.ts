import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CommentCreateWithoutAuthorInputSchema } from './CommentCreateWithoutAuthorInputSchema';
import { CommentUncheckedCreateWithoutAuthorInputSchema } from './CommentUncheckedCreateWithoutAuthorInputSchema';
import { CommentCreateOrConnectWithoutAuthorInputSchema } from './CommentCreateOrConnectWithoutAuthorInputSchema';
import { CommentUpsertWithWhereUniqueWithoutAuthorInputSchema } from './CommentUpsertWithWhereUniqueWithoutAuthorInputSchema';
import { CommentCreateManyAuthorInputEnvelopeSchema } from './CommentCreateManyAuthorInputEnvelopeSchema';
import { CommentWhereUniqueInputSchema } from './CommentWhereUniqueInputSchema';
import { CommentUpdateWithWhereUniqueWithoutAuthorInputSchema } from './CommentUpdateWithWhereUniqueWithoutAuthorInputSchema';
import { CommentUpdateManyWithWhereWithoutAuthorInputSchema } from './CommentUpdateManyWithWhereWithoutAuthorInputSchema';
import { CommentScalarWhereInputSchema } from './CommentScalarWhereInputSchema';

export const CommentUncheckedUpdateManyWithoutAuthorNestedInputSchema: z.ZodType<Prisma.CommentUncheckedUpdateManyWithoutAuthorNestedInput> = z.object({
  create: z.union([ z.lazy(() => CommentCreateWithoutAuthorInputSchema),z.lazy(() => CommentCreateWithoutAuthorInputSchema).array(),z.lazy(() => CommentUncheckedCreateWithoutAuthorInputSchema),z.lazy(() => CommentUncheckedCreateWithoutAuthorInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => CommentCreateOrConnectWithoutAuthorInputSchema),z.lazy(() => CommentCreateOrConnectWithoutAuthorInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => CommentUpsertWithWhereUniqueWithoutAuthorInputSchema),z.lazy(() => CommentUpsertWithWhereUniqueWithoutAuthorInputSchema).array() ]).optional(),
  createMany: z.lazy(() => CommentCreateManyAuthorInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => CommentWhereUniqueInputSchema),z.lazy(() => CommentWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => CommentWhereUniqueInputSchema),z.lazy(() => CommentWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => CommentWhereUniqueInputSchema),z.lazy(() => CommentWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => CommentWhereUniqueInputSchema),z.lazy(() => CommentWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => CommentUpdateWithWhereUniqueWithoutAuthorInputSchema),z.lazy(() => CommentUpdateWithWhereUniqueWithoutAuthorInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => CommentUpdateManyWithWhereWithoutAuthorInputSchema),z.lazy(() => CommentUpdateManyWithWhereWithoutAuthorInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => CommentScalarWhereInputSchema),z.lazy(() => CommentScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default CommentUncheckedUpdateManyWithoutAuthorNestedInputSchema;
