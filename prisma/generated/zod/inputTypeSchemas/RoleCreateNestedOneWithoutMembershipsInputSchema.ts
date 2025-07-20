import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { RoleCreateWithoutMembershipsInputSchema } from './RoleCreateWithoutMembershipsInputSchema';
import { RoleUncheckedCreateWithoutMembershipsInputSchema } from './RoleUncheckedCreateWithoutMembershipsInputSchema';
import { RoleCreateOrConnectWithoutMembershipsInputSchema } from './RoleCreateOrConnectWithoutMembershipsInputSchema';
import { RoleWhereUniqueInputSchema } from './RoleWhereUniqueInputSchema';

export const RoleCreateNestedOneWithoutMembershipsInputSchema: z.ZodType<Prisma.RoleCreateNestedOneWithoutMembershipsInput> = z.object({
  create: z.union([ z.lazy(() => RoleCreateWithoutMembershipsInputSchema),z.lazy(() => RoleUncheckedCreateWithoutMembershipsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => RoleCreateOrConnectWithoutMembershipsInputSchema).optional(),
  connect: z.lazy(() => RoleWhereUniqueInputSchema).optional()
}).strict();

export default RoleCreateNestedOneWithoutMembershipsInputSchema;
