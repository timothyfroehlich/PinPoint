import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationCreateWithoutRolesInputSchema } from './OrganizationCreateWithoutRolesInputSchema';
import { OrganizationUncheckedCreateWithoutRolesInputSchema } from './OrganizationUncheckedCreateWithoutRolesInputSchema';
import { OrganizationCreateOrConnectWithoutRolesInputSchema } from './OrganizationCreateOrConnectWithoutRolesInputSchema';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';

export const OrganizationCreateNestedOneWithoutRolesInputSchema: z.ZodType<Prisma.OrganizationCreateNestedOneWithoutRolesInput> = z.object({
  create: z.union([ z.lazy(() => OrganizationCreateWithoutRolesInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutRolesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutRolesInputSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional()
}).strict();

export default OrganizationCreateNestedOneWithoutRolesInputSchema;
