import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NotificationCreateManyUserInputSchema } from './NotificationCreateManyUserInputSchema';

export const NotificationCreateManyUserInputEnvelopeSchema: z.ZodType<Prisma.NotificationCreateManyUserInputEnvelope> = z.object({
  data: z.union([ z.lazy(() => NotificationCreateManyUserInputSchema),z.lazy(() => NotificationCreateManyUserInputSchema).array() ]),
  skipDuplicates: z.boolean().optional()
}).strict();

export default NotificationCreateManyUserInputEnvelopeSchema;
