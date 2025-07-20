import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFilterSchema } from './StringFilterSchema';
import { StringNullableFilterSchema } from './StringNullableFilterSchema';
import { DateTimeFilterSchema } from './DateTimeFilterSchema';
import { EnumActivityTypeFilterSchema } from './EnumActivityTypeFilterSchema';
import { ActivityTypeSchema } from './ActivityTypeSchema';

export const IssueHistoryScalarWhereInputSchema: z.ZodType<Prisma.IssueHistoryScalarWhereInput> = z.object({
  AND: z.union([ z.lazy(() => IssueHistoryScalarWhereInputSchema),z.lazy(() => IssueHistoryScalarWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => IssueHistoryScalarWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => IssueHistoryScalarWhereInputSchema),z.lazy(() => IssueHistoryScalarWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  field: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  oldValue: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  newValue: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  changedAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  organizationId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  actorId: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  type: z.union([ z.lazy(() => EnumActivityTypeFilterSchema),z.lazy(() => ActivityTypeSchema) ]).optional(),
  issueId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
}).strict();

export default IssueHistoryScalarWhereInputSchema;
