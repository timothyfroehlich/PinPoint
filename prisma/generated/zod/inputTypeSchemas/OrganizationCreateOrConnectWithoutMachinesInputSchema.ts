import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';
import { OrganizationCreateWithoutMachinesInputSchema } from './OrganizationCreateWithoutMachinesInputSchema';
import { OrganizationUncheckedCreateWithoutMachinesInputSchema } from './OrganizationUncheckedCreateWithoutMachinesInputSchema';

export const OrganizationCreateOrConnectWithoutMachinesInputSchema: z.ZodType<Prisma.OrganizationCreateOrConnectWithoutMachinesInput> = z.object({
  where: z.lazy(() => OrganizationWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => OrganizationCreateWithoutMachinesInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutMachinesInputSchema) ]),
}).strict();

export default OrganizationCreateOrConnectWithoutMachinesInputSchema;
