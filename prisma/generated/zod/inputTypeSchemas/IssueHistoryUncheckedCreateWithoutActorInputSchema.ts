import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { ActivityTypeSchema } from './ActivityTypeSchema';

export const IssueHistoryUncheckedCreateWithoutActorInputSchema: z.ZodType<Prisma.IssueHistoryUncheckedCreateWithoutActorInput> = z.object({
  id: z.string().cuid().optional(),
  field: z.string(),
  oldValue: z.string().optional().nullable(),
  newValue: z.string().optional().nullable(),
  changedAt: z.coerce.date().optional(),
  organizationId: z.string(),
  type: z.lazy(() => ActivityTypeSchema),
  issueId: z.string()
}).strict();

export default IssueHistoryUncheckedCreateWithoutActorInputSchema;
