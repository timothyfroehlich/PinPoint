import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';
import { OrganizationUpdateWithoutMachinesInputSchema } from './OrganizationUpdateWithoutMachinesInputSchema';
import { OrganizationUncheckedUpdateWithoutMachinesInputSchema } from './OrganizationUncheckedUpdateWithoutMachinesInputSchema';

export const OrganizationUpdateToOneWithWhereWithoutMachinesInputSchema: z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutMachinesInput> = z.object({
  where: z.lazy(() => OrganizationWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => OrganizationUpdateWithoutMachinesInputSchema),z.lazy(() => OrganizationUncheckedUpdateWithoutMachinesInputSchema) ]),
}).strict();

export default OrganizationUpdateToOneWithWhereWithoutMachinesInputSchema;
