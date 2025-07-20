import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { ActivityTypeSchema } from './ActivityTypeSchema';
import { IssueCreateNestedOneWithoutHistoryInputSchema } from './IssueCreateNestedOneWithoutHistoryInputSchema';
import { OrganizationCreateNestedOneWithoutIssueHistoryInputSchema } from './OrganizationCreateNestedOneWithoutIssueHistoryInputSchema';
import { UserCreateNestedOneWithoutActivityHistoryInputSchema } from './UserCreateNestedOneWithoutActivityHistoryInputSchema';

export const IssueHistoryCreateInputSchema: z.ZodType<Prisma.IssueHistoryCreateInput> = z.object({
  id: z.string().cuid().optional(),
  field: z.string(),
  oldValue: z.string().optional().nullable(),
  newValue: z.string().optional().nullable(),
  changedAt: z.coerce.date().optional(),
  type: z.lazy(() => ActivityTypeSchema),
  issue: z.lazy(() => IssueCreateNestedOneWithoutHistoryInputSchema),
  organization: z.lazy(() => OrganizationCreateNestedOneWithoutIssueHistoryInputSchema),
  actor: z.lazy(() => UserCreateNestedOneWithoutActivityHistoryInputSchema).optional()
}).strict();

export default IssueHistoryCreateInputSchema;
