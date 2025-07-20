import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { RoleWhereUniqueInputSchema } from './RoleWhereUniqueInputSchema';
import { RoleUpdateWithoutOrganizationInputSchema } from './RoleUpdateWithoutOrganizationInputSchema';
import { RoleUncheckedUpdateWithoutOrganizationInputSchema } from './RoleUncheckedUpdateWithoutOrganizationInputSchema';

export const RoleUpdateWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.RoleUpdateWithWhereUniqueWithoutOrganizationInput> = z.object({
  where: z.lazy(() => RoleWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => RoleUpdateWithoutOrganizationInputSchema),z.lazy(() => RoleUncheckedUpdateWithoutOrganizationInputSchema) ]),
}).strict();

export default RoleUpdateWithWhereUniqueWithoutOrganizationInputSchema;
