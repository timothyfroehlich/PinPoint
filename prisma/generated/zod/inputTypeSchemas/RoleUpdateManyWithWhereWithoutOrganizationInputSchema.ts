import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { RoleScalarWhereInputSchema } from './RoleScalarWhereInputSchema';
import { RoleUpdateManyMutationInputSchema } from './RoleUpdateManyMutationInputSchema';
import { RoleUncheckedUpdateManyWithoutOrganizationInputSchema } from './RoleUncheckedUpdateManyWithoutOrganizationInputSchema';

export const RoleUpdateManyWithWhereWithoutOrganizationInputSchema: z.ZodType<Prisma.RoleUpdateManyWithWhereWithoutOrganizationInput> = z.object({
  where: z.lazy(() => RoleScalarWhereInputSchema),
  data: z.union([ z.lazy(() => RoleUpdateManyMutationInputSchema),z.lazy(() => RoleUncheckedUpdateManyWithoutOrganizationInputSchema) ]),
}).strict();

export default RoleUpdateManyWithWhereWithoutOrganizationInputSchema;
