import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { RoleWhereUniqueInputSchema } from './RoleWhereUniqueInputSchema';
import { RoleUpdateWithoutOrganizationInputSchema } from './RoleUpdateWithoutOrganizationInputSchema';
import { RoleUncheckedUpdateWithoutOrganizationInputSchema } from './RoleUncheckedUpdateWithoutOrganizationInputSchema';
import { RoleCreateWithoutOrganizationInputSchema } from './RoleCreateWithoutOrganizationInputSchema';
import { RoleUncheckedCreateWithoutOrganizationInputSchema } from './RoleUncheckedCreateWithoutOrganizationInputSchema';

export const RoleUpsertWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.RoleUpsertWithWhereUniqueWithoutOrganizationInput> = z.object({
  where: z.lazy(() => RoleWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => RoleUpdateWithoutOrganizationInputSchema),z.lazy(() => RoleUncheckedUpdateWithoutOrganizationInputSchema) ]),
  create: z.union([ z.lazy(() => RoleCreateWithoutOrganizationInputSchema),z.lazy(() => RoleUncheckedCreateWithoutOrganizationInputSchema) ]),
}).strict();

export default RoleUpsertWithWhereUniqueWithoutOrganizationInputSchema;
