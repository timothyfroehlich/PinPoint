import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { ActivityTypeSchema } from './ActivityTypeSchema';
import { IssueCreateNestedOneWithoutHistoryInputSchema } from './IssueCreateNestedOneWithoutHistoryInputSchema';
import { OrganizationCreateNestedOneWithoutIssueHistoryInputSchema } from './OrganizationCreateNestedOneWithoutIssueHistoryInputSchema';

export const IssueHistoryCreateWithoutActorInputSchema: z.ZodType<Prisma.IssueHistoryCreateWithoutActorInput> = z.object({
  id: z.string().cuid().optional(),
  field: z.string(),
  oldValue: z.string().optional().nullable(),
  newValue: z.string().optional().nullable(),
  changedAt: z.coerce.date().optional(),
  type: z.lazy(() => ActivityTypeSchema),
  issue: z.lazy(() => IssueCreateNestedOneWithoutHistoryInputSchema),
  organization: z.lazy(() => OrganizationCreateNestedOneWithoutIssueHistoryInputSchema)
}).strict();

export default IssueHistoryCreateWithoutActorInputSchema;
