import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { RoleCreateWithoutMembershipsInputSchema } from './RoleCreateWithoutMembershipsInputSchema';
import { RoleUncheckedCreateWithoutMembershipsInputSchema } from './RoleUncheckedCreateWithoutMembershipsInputSchema';
import { RoleCreateOrConnectWithoutMembershipsInputSchema } from './RoleCreateOrConnectWithoutMembershipsInputSchema';
import { RoleUpsertWithoutMembershipsInputSchema } from './RoleUpsertWithoutMembershipsInputSchema';
import { RoleWhereUniqueInputSchema } from './RoleWhereUniqueInputSchema';
import { RoleUpdateToOneWithWhereWithoutMembershipsInputSchema } from './RoleUpdateToOneWithWhereWithoutMembershipsInputSchema';
import { RoleUpdateWithoutMembershipsInputSchema } from './RoleUpdateWithoutMembershipsInputSchema';
import { RoleUncheckedUpdateWithoutMembershipsInputSchema } from './RoleUncheckedUpdateWithoutMembershipsInputSchema';

export const RoleUpdateOneRequiredWithoutMembershipsNestedInputSchema: z.ZodType<Prisma.RoleUpdateOneRequiredWithoutMembershipsNestedInput> = z.object({
  create: z.union([ z.lazy(() => RoleCreateWithoutMembershipsInputSchema),z.lazy(() => RoleUncheckedCreateWithoutMembershipsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => RoleCreateOrConnectWithoutMembershipsInputSchema).optional(),
  upsert: z.lazy(() => RoleUpsertWithoutMembershipsInputSchema).optional(),
  connect: z.lazy(() => RoleWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => RoleUpdateToOneWithWhereWithoutMembershipsInputSchema),z.lazy(() => RoleUpdateWithoutMembershipsInputSchema),z.lazy(() => RoleUncheckedUpdateWithoutMembershipsInputSchema) ]).optional(),
}).strict();

export default RoleUpdateOneRequiredWithoutMembershipsNestedInputSchema;
