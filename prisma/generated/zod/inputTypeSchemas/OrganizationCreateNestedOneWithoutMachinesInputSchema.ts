import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationCreateWithoutMachinesInputSchema } from './OrganizationCreateWithoutMachinesInputSchema';
import { OrganizationUncheckedCreateWithoutMachinesInputSchema } from './OrganizationUncheckedCreateWithoutMachinesInputSchema';
import { OrganizationCreateOrConnectWithoutMachinesInputSchema } from './OrganizationCreateOrConnectWithoutMachinesInputSchema';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';

export const OrganizationCreateNestedOneWithoutMachinesInputSchema: z.ZodType<Prisma.OrganizationCreateNestedOneWithoutMachinesInput> = z.object({
  create: z.union([ z.lazy(() => OrganizationCreateWithoutMachinesInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutMachinesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutMachinesInputSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional()
}).strict();

export default OrganizationCreateNestedOneWithoutMachinesInputSchema;
