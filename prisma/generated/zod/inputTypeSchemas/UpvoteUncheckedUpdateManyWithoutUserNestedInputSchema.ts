import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UpvoteCreateWithoutUserInputSchema } from './UpvoteCreateWithoutUserInputSchema';
import { UpvoteUncheckedCreateWithoutUserInputSchema } from './UpvoteUncheckedCreateWithoutUserInputSchema';
import { UpvoteCreateOrConnectWithoutUserInputSchema } from './UpvoteCreateOrConnectWithoutUserInputSchema';
import { UpvoteUpsertWithWhereUniqueWithoutUserInputSchema } from './UpvoteUpsertWithWhereUniqueWithoutUserInputSchema';
import { UpvoteCreateManyUserInputEnvelopeSchema } from './UpvoteCreateManyUserInputEnvelopeSchema';
import { UpvoteWhereUniqueInputSchema } from './UpvoteWhereUniqueInputSchema';
import { UpvoteUpdateWithWhereUniqueWithoutUserInputSchema } from './UpvoteUpdateWithWhereUniqueWithoutUserInputSchema';
import { UpvoteUpdateManyWithWhereWithoutUserInputSchema } from './UpvoteUpdateManyWithWhereWithoutUserInputSchema';
import { UpvoteScalarWhereInputSchema } from './UpvoteScalarWhereInputSchema';

export const UpvoteUncheckedUpdateManyWithoutUserNestedInputSchema: z.ZodType<Prisma.UpvoteUncheckedUpdateManyWithoutUserNestedInput> = z.object({
  create: z.union([ z.lazy(() => UpvoteCreateWithoutUserInputSchema),z.lazy(() => UpvoteCreateWithoutUserInputSchema).array(),z.lazy(() => UpvoteUncheckedCreateWithoutUserInputSchema),z.lazy(() => UpvoteUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => UpvoteCreateOrConnectWithoutUserInputSchema),z.lazy(() => UpvoteCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => UpvoteUpsertWithWhereUniqueWithoutUserInputSchema),z.lazy(() => UpvoteUpsertWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => UpvoteCreateManyUserInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => UpvoteWhereUniqueInputSchema),z.lazy(() => UpvoteWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => UpvoteWhereUniqueInputSchema),z.lazy(() => UpvoteWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => UpvoteWhereUniqueInputSchema),z.lazy(() => UpvoteWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => UpvoteWhereUniqueInputSchema),z.lazy(() => UpvoteWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => UpvoteUpdateWithWhereUniqueWithoutUserInputSchema),z.lazy(() => UpvoteUpdateWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => UpvoteUpdateManyWithWhereWithoutUserInputSchema),z.lazy(() => UpvoteUpdateManyWithWhereWithoutUserInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => UpvoteScalarWhereInputSchema),z.lazy(() => UpvoteScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default UpvoteUncheckedUpdateManyWithoutUserNestedInputSchema;
