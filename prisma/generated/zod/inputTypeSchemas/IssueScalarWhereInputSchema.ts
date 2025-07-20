import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFilterSchema } from './StringFilterSchema';
import { StringNullableFilterSchema } from './StringNullableFilterSchema';
import { JsonNullableFilterSchema } from './JsonNullableFilterSchema';
import { DateTimeFilterSchema } from './DateTimeFilterSchema';
import { DateTimeNullableFilterSchema } from './DateTimeNullableFilterSchema';

export const IssueScalarWhereInputSchema: z.ZodType<Prisma.IssueScalarWhereInput> = z.object({
  AND: z.union([ z.lazy(() => IssueScalarWhereInputSchema),z.lazy(() => IssueScalarWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => IssueScalarWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => IssueScalarWhereInputSchema),z.lazy(() => IssueScalarWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  title: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  description: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  consistency: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  checklist: z.lazy(() => JsonNullableFilterSchema).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  resolvedAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema),z.coerce.date() ]).optional().nullable(),
  organizationId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  machineId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  statusId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  priorityId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  createdById: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  assignedToId: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
}).strict();

export default IssueScalarWhereInputSchema;
