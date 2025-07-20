import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';
import { OrganizationUpdateWithoutPrioritiesInputSchema } from './OrganizationUpdateWithoutPrioritiesInputSchema';
import { OrganizationUncheckedUpdateWithoutPrioritiesInputSchema } from './OrganizationUncheckedUpdateWithoutPrioritiesInputSchema';

export const OrganizationUpdateToOneWithWhereWithoutPrioritiesInputSchema: z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutPrioritiesInput> = z.object({
  where: z.lazy(() => OrganizationWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => OrganizationUpdateWithoutPrioritiesInputSchema),z.lazy(() => OrganizationUncheckedUpdateWithoutPrioritiesInputSchema) ]),
}).strict();

export default OrganizationUpdateToOneWithWhereWithoutPrioritiesInputSchema;
