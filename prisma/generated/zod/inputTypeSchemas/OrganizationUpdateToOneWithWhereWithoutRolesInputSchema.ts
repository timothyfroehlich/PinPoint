import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';
import { OrganizationUpdateWithoutRolesInputSchema } from './OrganizationUpdateWithoutRolesInputSchema';
import { OrganizationUncheckedUpdateWithoutRolesInputSchema } from './OrganizationUncheckedUpdateWithoutRolesInputSchema';

export const OrganizationUpdateToOneWithWhereWithoutRolesInputSchema: z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutRolesInput> = z.object({
  where: z.lazy(() => OrganizationWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => OrganizationUpdateWithoutRolesInputSchema),z.lazy(() => OrganizationUncheckedUpdateWithoutRolesInputSchema) ]),
}).strict();

export default OrganizationUpdateToOneWithWhereWithoutRolesInputSchema;
