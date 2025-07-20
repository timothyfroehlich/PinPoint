import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NullableJsonNullValueInputSchema } from './NullableJsonNullValueInputSchema';
import { InputJsonValueSchema } from './InputJsonValueSchema';

export const IssueCreateManyInputSchema: z.ZodType<Prisma.IssueCreateManyInput> = z.object({
  id: z.string().cuid().optional(),
  title: z.string(),
  description: z.string().optional().nullable(),
  consistency: z.string().optional().nullable(),
  checklist: z.union([ z.lazy(() => NullableJsonNullValueInputSchema),InputJsonValueSchema ]).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  resolvedAt: z.coerce.date().optional().nullable(),
  organizationId: z.string(),
  machineId: z.string(),
  statusId: z.string(),
  priorityId: z.string(),
  createdById: z.string(),
  assignedToId: z.string().optional().nullable()
}).strict();

export default IssueCreateManyInputSchema;
