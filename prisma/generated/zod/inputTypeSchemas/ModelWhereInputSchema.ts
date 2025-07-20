import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFilterSchema } from './StringFilterSchema';
import { StringNullableFilterSchema } from './StringNullableFilterSchema';
import { IntNullableFilterSchema } from './IntNullableFilterSchema';
import { BoolFilterSchema } from './BoolFilterSchema';
import { MachineListRelationFilterSchema } from './MachineListRelationFilterSchema';

export const ModelWhereInputSchema: z.ZodType<Prisma.ModelWhereInput> = z.object({
  AND: z.union([ z.lazy(() => ModelWhereInputSchema),z.lazy(() => ModelWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => ModelWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => ModelWhereInputSchema),z.lazy(() => ModelWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  manufacturer: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  year: z.union([ z.lazy(() => IntNullableFilterSchema),z.number() ]).optional().nullable(),
  ipdbId: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  opdbId: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  machineType: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  machineDisplay: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  isActive: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  ipdbLink: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  opdbImgUrl: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  kineticistUrl: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  isCustom: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  machines: z.lazy(() => MachineListRelationFilterSchema).optional()
}).strict();

export default ModelWhereInputSchema;
