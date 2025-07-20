import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NotificationScalarWhereInputSchema } from './NotificationScalarWhereInputSchema';
import { NotificationUpdateManyMutationInputSchema } from './NotificationUpdateManyMutationInputSchema';
import { NotificationUncheckedUpdateManyWithoutUserInputSchema } from './NotificationUncheckedUpdateManyWithoutUserInputSchema';

export const NotificationUpdateManyWithWhereWithoutUserInputSchema: z.ZodType<Prisma.NotificationUpdateManyWithWhereWithoutUserInput> = z.object({
  where: z.lazy(() => NotificationScalarWhereInputSchema),
  data: z.union([ z.lazy(() => NotificationUpdateManyMutationInputSchema),z.lazy(() => NotificationUncheckedUpdateManyWithoutUserInputSchema) ]),
}).strict();

export default NotificationUpdateManyWithWhereWithoutUserInputSchema;
