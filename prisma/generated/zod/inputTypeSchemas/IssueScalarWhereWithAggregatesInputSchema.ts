import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringWithAggregatesFilterSchema } from './StringWithAggregatesFilterSchema';
import { StringNullableWithAggregatesFilterSchema } from './StringNullableWithAggregatesFilterSchema';
import { JsonNullableWithAggregatesFilterSchema } from './JsonNullableWithAggregatesFilterSchema';
import { DateTimeWithAggregatesFilterSchema } from './DateTimeWithAggregatesFilterSchema';
import { DateTimeNullableWithAggregatesFilterSchema } from './DateTimeNullableWithAggregatesFilterSchema';

export const IssueScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.IssueScalarWhereWithAggregatesInput> = z.object({
  AND: z.union([ z.lazy(() => IssueScalarWhereWithAggregatesInputSchema),z.lazy(() => IssueScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  OR: z.lazy(() => IssueScalarWhereWithAggregatesInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => IssueScalarWhereWithAggregatesInputSchema),z.lazy(() => IssueScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  title: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  description: z.union([ z.lazy(() => StringNullableWithAggregatesFilterSchema),z.string() ]).optional().nullable(),
  consistency: z.union([ z.lazy(() => StringNullableWithAggregatesFilterSchema),z.string() ]).optional().nullable(),
  checklist: z.lazy(() => JsonNullableWithAggregatesFilterSchema).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema),z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema),z.coerce.date() ]).optional(),
  resolvedAt: z.union([ z.lazy(() => DateTimeNullableWithAggregatesFilterSchema),z.coerce.date() ]).optional().nullable(),
  organizationId: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  machineId: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  statusId: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  priorityId: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  createdById: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  assignedToId: z.union([ z.lazy(() => StringNullableWithAggregatesFilterSchema),z.string() ]).optional().nullable(),
}).strict();

export default IssueScalarWhereWithAggregatesInputSchema;
