import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NotificationCreateWithoutUserInputSchema } from './NotificationCreateWithoutUserInputSchema';
import { NotificationUncheckedCreateWithoutUserInputSchema } from './NotificationUncheckedCreateWithoutUserInputSchema';
import { NotificationCreateOrConnectWithoutUserInputSchema } from './NotificationCreateOrConnectWithoutUserInputSchema';
import { NotificationCreateManyUserInputEnvelopeSchema } from './NotificationCreateManyUserInputEnvelopeSchema';
import { NotificationWhereUniqueInputSchema } from './NotificationWhereUniqueInputSchema';

export const NotificationUncheckedCreateNestedManyWithoutUserInputSchema: z.ZodType<Prisma.NotificationUncheckedCreateNestedManyWithoutUserInput> = z.object({
  create: z.union([ z.lazy(() => NotificationCreateWithoutUserInputSchema),z.lazy(() => NotificationCreateWithoutUserInputSchema).array(),z.lazy(() => NotificationUncheckedCreateWithoutUserInputSchema),z.lazy(() => NotificationUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => NotificationCreateOrConnectWithoutUserInputSchema),z.lazy(() => NotificationCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => NotificationCreateManyUserInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => NotificationWhereUniqueInputSchema),z.lazy(() => NotificationWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default NotificationUncheckedCreateNestedManyWithoutUserInputSchema;
