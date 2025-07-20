import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFilterSchema } from './StringFilterSchema';
import { BoolFilterSchema } from './BoolFilterSchema';
import { StringNullableFilterSchema } from './StringNullableFilterSchema';
import { IntFilterSchema } from './IntFilterSchema';
import { DateTimeNullableFilterSchema } from './DateTimeNullableFilterSchema';
import { OrganizationScalarRelationFilterSchema } from './OrganizationScalarRelationFilterSchema';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';

export const PinballMapConfigWhereInputSchema: z.ZodType<Prisma.PinballMapConfigWhereInput> = z.object({
  AND: z.union([ z.lazy(() => PinballMapConfigWhereInputSchema),z.lazy(() => PinballMapConfigWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => PinballMapConfigWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => PinballMapConfigWhereInputSchema),z.lazy(() => PinballMapConfigWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  organizationId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  apiEnabled: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  apiKey: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  autoSyncEnabled: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  syncIntervalHours: z.union([ z.lazy(() => IntFilterSchema),z.number() ]).optional(),
  lastGlobalSync: z.union([ z.lazy(() => DateTimeNullableFilterSchema),z.coerce.date() ]).optional().nullable(),
  createMissingModels: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  updateExistingData: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  organization: z.union([ z.lazy(() => OrganizationScalarRelationFilterSchema),z.lazy(() => OrganizationWhereInputSchema) ]).optional(),
}).strict();

export default PinballMapConfigWhereInputSchema;
