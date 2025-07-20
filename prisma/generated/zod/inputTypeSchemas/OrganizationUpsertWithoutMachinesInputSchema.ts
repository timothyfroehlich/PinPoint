import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationUpdateWithoutMachinesInputSchema } from './OrganizationUpdateWithoutMachinesInputSchema';
import { OrganizationUncheckedUpdateWithoutMachinesInputSchema } from './OrganizationUncheckedUpdateWithoutMachinesInputSchema';
import { OrganizationCreateWithoutMachinesInputSchema } from './OrganizationCreateWithoutMachinesInputSchema';
import { OrganizationUncheckedCreateWithoutMachinesInputSchema } from './OrganizationUncheckedCreateWithoutMachinesInputSchema';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';

export const OrganizationUpsertWithoutMachinesInputSchema: z.ZodType<Prisma.OrganizationUpsertWithoutMachinesInput> = z.object({
  update: z.union([ z.lazy(() => OrganizationUpdateWithoutMachinesInputSchema),z.lazy(() => OrganizationUncheckedUpdateWithoutMachinesInputSchema) ]),
  create: z.union([ z.lazy(() => OrganizationCreateWithoutMachinesInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutMachinesInputSchema) ]),
  where: z.lazy(() => OrganizationWhereInputSchema).optional()
}).strict();

export default OrganizationUpsertWithoutMachinesInputSchema;
