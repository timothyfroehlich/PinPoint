import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';
import { OrganizationCreateWithoutRolesInputSchema } from './OrganizationCreateWithoutRolesInputSchema';
import { OrganizationUncheckedCreateWithoutRolesInputSchema } from './OrganizationUncheckedCreateWithoutRolesInputSchema';

export const OrganizationCreateOrConnectWithoutRolesInputSchema: z.ZodType<Prisma.OrganizationCreateOrConnectWithoutRolesInput> = z.object({
  where: z.lazy(() => OrganizationWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => OrganizationCreateWithoutRolesInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutRolesInputSchema) ]),
}).strict();

export default OrganizationCreateOrConnectWithoutRolesInputSchema;
