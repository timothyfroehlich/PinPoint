import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFilterSchema } from './StringFilterSchema';
import { StringNullableFilterSchema } from './StringNullableFilterSchema';
import { BoolFilterSchema } from './BoolFilterSchema';
import { DateTimeNullableFilterSchema } from './DateTimeNullableFilterSchema';

export const MachineScalarWhereInputSchema: z.ZodType<Prisma.MachineScalarWhereInput> = z.object({
  AND: z.union([ z.lazy(() => MachineScalarWhereInputSchema),z.lazy(() => MachineScalarWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => MachineScalarWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => MachineScalarWhereInputSchema),z.lazy(() => MachineScalarWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  organizationId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  locationId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  modelId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  ownerId: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  ownerNotificationsEnabled: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  notifyOnNewIssues: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  notifyOnStatusChanges: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  notifyOnComments: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  qrCodeId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  qrCodeUrl: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  qrCodeGeneratedAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema),z.coerce.date() ]).optional().nullable(),
}).strict();

export default MachineScalarWhereInputSchema;
