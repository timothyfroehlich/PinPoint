import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { ActivityTypeSchema } from './ActivityTypeSchema';

export const IssueHistoryUncheckedCreateWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueHistoryUncheckedCreateWithoutOrganizationInput> = z.object({
  id: z.string().cuid().optional(),
  field: z.string(),
  oldValue: z.string().optional().nullable(),
  newValue: z.string().optional().nullable(),
  changedAt: z.coerce.date().optional(),
  actorId: z.string().optional().nullable(),
  type: z.lazy(() => ActivityTypeSchema),
  issueId: z.string()
}).strict();

export default IssueHistoryUncheckedCreateWithoutOrganizationInputSchema;
