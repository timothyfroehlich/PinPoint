import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NotificationWhereUniqueInputSchema } from './NotificationWhereUniqueInputSchema';
import { NotificationUpdateWithoutUserInputSchema } from './NotificationUpdateWithoutUserInputSchema';
import { NotificationUncheckedUpdateWithoutUserInputSchema } from './NotificationUncheckedUpdateWithoutUserInputSchema';
import { NotificationCreateWithoutUserInputSchema } from './NotificationCreateWithoutUserInputSchema';
import { NotificationUncheckedCreateWithoutUserInputSchema } from './NotificationUncheckedCreateWithoutUserInputSchema';

export const NotificationUpsertWithWhereUniqueWithoutUserInputSchema: z.ZodType<Prisma.NotificationUpsertWithWhereUniqueWithoutUserInput> = z.object({
  where: z.lazy(() => NotificationWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => NotificationUpdateWithoutUserInputSchema),z.lazy(() => NotificationUncheckedUpdateWithoutUserInputSchema) ]),
  create: z.union([ z.lazy(() => NotificationCreateWithoutUserInputSchema),z.lazy(() => NotificationUncheckedCreateWithoutUserInputSchema) ]),
}).strict();

export default NotificationUpsertWithWhereUniqueWithoutUserInputSchema;
