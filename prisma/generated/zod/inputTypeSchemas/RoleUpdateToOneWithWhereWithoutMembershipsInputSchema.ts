import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { RoleWhereInputSchema } from './RoleWhereInputSchema';
import { RoleUpdateWithoutMembershipsInputSchema } from './RoleUpdateWithoutMembershipsInputSchema';
import { RoleUncheckedUpdateWithoutMembershipsInputSchema } from './RoleUncheckedUpdateWithoutMembershipsInputSchema';

export const RoleUpdateToOneWithWhereWithoutMembershipsInputSchema: z.ZodType<Prisma.RoleUpdateToOneWithWhereWithoutMembershipsInput> = z.object({
  where: z.lazy(() => RoleWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => RoleUpdateWithoutMembershipsInputSchema),z.lazy(() => RoleUncheckedUpdateWithoutMembershipsInputSchema) ]),
}).strict();

export default RoleUpdateToOneWithWhereWithoutMembershipsInputSchema;
