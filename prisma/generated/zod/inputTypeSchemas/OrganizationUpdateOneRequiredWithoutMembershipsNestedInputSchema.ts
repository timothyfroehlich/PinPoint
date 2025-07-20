import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationCreateWithoutMembershipsInputSchema } from './OrganizationCreateWithoutMembershipsInputSchema';
import { OrganizationUncheckedCreateWithoutMembershipsInputSchema } from './OrganizationUncheckedCreateWithoutMembershipsInputSchema';
import { OrganizationCreateOrConnectWithoutMembershipsInputSchema } from './OrganizationCreateOrConnectWithoutMembershipsInputSchema';
import { OrganizationUpsertWithoutMembershipsInputSchema } from './OrganizationUpsertWithoutMembershipsInputSchema';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';
import { OrganizationUpdateToOneWithWhereWithoutMembershipsInputSchema } from './OrganizationUpdateToOneWithWhereWithoutMembershipsInputSchema';
import { OrganizationUpdateWithoutMembershipsInputSchema } from './OrganizationUpdateWithoutMembershipsInputSchema';
import { OrganizationUncheckedUpdateWithoutMembershipsInputSchema } from './OrganizationUncheckedUpdateWithoutMembershipsInputSchema';

export const OrganizationUpdateOneRequiredWithoutMembershipsNestedInputSchema: z.ZodType<Prisma.OrganizationUpdateOneRequiredWithoutMembershipsNestedInput> = z.object({
  create: z.union([ z.lazy(() => OrganizationCreateWithoutMembershipsInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutMembershipsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutMembershipsInputSchema).optional(),
  upsert: z.lazy(() => OrganizationUpsertWithoutMembershipsInputSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => OrganizationUpdateToOneWithWhereWithoutMembershipsInputSchema),z.lazy(() => OrganizationUpdateWithoutMembershipsInputSchema),z.lazy(() => OrganizationUncheckedUpdateWithoutMembershipsInputSchema) ]).optional(),
}).strict();

export default OrganizationUpdateOneRequiredWithoutMembershipsNestedInputSchema;
