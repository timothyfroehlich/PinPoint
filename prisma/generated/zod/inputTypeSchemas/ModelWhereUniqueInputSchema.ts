import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { ModelWhereInputSchema } from './ModelWhereInputSchema';
import { StringFilterSchema } from './StringFilterSchema';
import { StringNullableFilterSchema } from './StringNullableFilterSchema';
import { IntNullableFilterSchema } from './IntNullableFilterSchema';
import { BoolFilterSchema } from './BoolFilterSchema';
import { MachineListRelationFilterSchema } from './MachineListRelationFilterSchema';

export const ModelWhereUniqueInputSchema: z.ZodType<Prisma.ModelWhereUniqueInput> = z.union([
  z.object({
    id: z.string().cuid(),
    ipdbId: z.string(),
    opdbId: z.string()
  }),
  z.object({
    id: z.string().cuid(),
    ipdbId: z.string(),
  }),
  z.object({
    id: z.string().cuid(),
    opdbId: z.string(),
  }),
  z.object({
    id: z.string().cuid(),
  }),
  z.object({
    ipdbId: z.string(),
    opdbId: z.string(),
  }),
  z.object({
    ipdbId: z.string(),
  }),
  z.object({
    opdbId: z.string(),
  }),
])
.and(z.object({
  id: z.string().cuid().optional(),
  ipdbId: z.string().optional(),
  opdbId: z.string().optional(),
  AND: z.union([ z.lazy(() => ModelWhereInputSchema),z.lazy(() => ModelWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => ModelWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => ModelWhereInputSchema),z.lazy(() => ModelWhereInputSchema).array() ]).optional(),
  name: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  manufacturer: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  year: z.union([ z.lazy(() => IntNullableFilterSchema),z.number().int() ]).optional().nullable(),
  machineType: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  machineDisplay: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  isActive: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  ipdbLink: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  opdbImgUrl: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  kineticistUrl: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  isCustom: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  machines: z.lazy(() => MachineListRelationFilterSchema).optional()
}).strict());

export default ModelWhereUniqueInputSchema;
