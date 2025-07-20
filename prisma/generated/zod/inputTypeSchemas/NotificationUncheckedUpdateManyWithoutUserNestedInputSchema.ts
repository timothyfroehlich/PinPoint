import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NotificationCreateWithoutUserInputSchema } from './NotificationCreateWithoutUserInputSchema';
import { NotificationUncheckedCreateWithoutUserInputSchema } from './NotificationUncheckedCreateWithoutUserInputSchema';
import { NotificationCreateOrConnectWithoutUserInputSchema } from './NotificationCreateOrConnectWithoutUserInputSchema';
import { NotificationUpsertWithWhereUniqueWithoutUserInputSchema } from './NotificationUpsertWithWhereUniqueWithoutUserInputSchema';
import { NotificationCreateManyUserInputEnvelopeSchema } from './NotificationCreateManyUserInputEnvelopeSchema';
import { NotificationWhereUniqueInputSchema } from './NotificationWhereUniqueInputSchema';
import { NotificationUpdateWithWhereUniqueWithoutUserInputSchema } from './NotificationUpdateWithWhereUniqueWithoutUserInputSchema';
import { NotificationUpdateManyWithWhereWithoutUserInputSchema } from './NotificationUpdateManyWithWhereWithoutUserInputSchema';
import { NotificationScalarWhereInputSchema } from './NotificationScalarWhereInputSchema';

export const NotificationUncheckedUpdateManyWithoutUserNestedInputSchema: z.ZodType<Prisma.NotificationUncheckedUpdateManyWithoutUserNestedInput> = z.object({
  create: z.union([ z.lazy(() => NotificationCreateWithoutUserInputSchema),z.lazy(() => NotificationCreateWithoutUserInputSchema).array(),z.lazy(() => NotificationUncheckedCreateWithoutUserInputSchema),z.lazy(() => NotificationUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => NotificationCreateOrConnectWithoutUserInputSchema),z.lazy(() => NotificationCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => NotificationUpsertWithWhereUniqueWithoutUserInputSchema),z.lazy(() => NotificationUpsertWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => NotificationCreateManyUserInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => NotificationWhereUniqueInputSchema),z.lazy(() => NotificationWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => NotificationWhereUniqueInputSchema),z.lazy(() => NotificationWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => NotificationWhereUniqueInputSchema),z.lazy(() => NotificationWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => NotificationWhereUniqueInputSchema),z.lazy(() => NotificationWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => NotificationUpdateWithWhereUniqueWithoutUserInputSchema),z.lazy(() => NotificationUpdateWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => NotificationUpdateManyWithWhereWithoutUserInputSchema),z.lazy(() => NotificationUpdateManyWithWhereWithoutUserInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => NotificationScalarWhereInputSchema),z.lazy(() => NotificationScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default NotificationUncheckedUpdateManyWithoutUserNestedInputSchema;
