import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';
import { OrganizationUpdateWithoutPinballMapConfigInputSchema } from './OrganizationUpdateWithoutPinballMapConfigInputSchema';
import { OrganizationUncheckedUpdateWithoutPinballMapConfigInputSchema } from './OrganizationUncheckedUpdateWithoutPinballMapConfigInputSchema';

export const OrganizationUpdateToOneWithWhereWithoutPinballMapConfigInputSchema: z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutPinballMapConfigInput> = z.object({
  where: z.lazy(() => OrganizationWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => OrganizationUpdateWithoutPinballMapConfigInputSchema),z.lazy(() => OrganizationUncheckedUpdateWithoutPinballMapConfigInputSchema) ]),
}).strict();

export default OrganizationUpdateToOneWithWhereWithoutPinballMapConfigInputSchema;
