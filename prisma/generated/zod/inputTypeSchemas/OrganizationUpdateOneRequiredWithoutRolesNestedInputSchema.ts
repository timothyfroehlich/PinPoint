import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationCreateWithoutRolesInputSchema } from './OrganizationCreateWithoutRolesInputSchema';
import { OrganizationUncheckedCreateWithoutRolesInputSchema } from './OrganizationUncheckedCreateWithoutRolesInputSchema';
import { OrganizationCreateOrConnectWithoutRolesInputSchema } from './OrganizationCreateOrConnectWithoutRolesInputSchema';
import { OrganizationUpsertWithoutRolesInputSchema } from './OrganizationUpsertWithoutRolesInputSchema';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';
import { OrganizationUpdateToOneWithWhereWithoutRolesInputSchema } from './OrganizationUpdateToOneWithWhereWithoutRolesInputSchema';
import { OrganizationUpdateWithoutRolesInputSchema } from './OrganizationUpdateWithoutRolesInputSchema';
import { OrganizationUncheckedUpdateWithoutRolesInputSchema } from './OrganizationUncheckedUpdateWithoutRolesInputSchema';

export const OrganizationUpdateOneRequiredWithoutRolesNestedInputSchema: z.ZodType<Prisma.OrganizationUpdateOneRequiredWithoutRolesNestedInput> = z.object({
  create: z.union([ z.lazy(() => OrganizationCreateWithoutRolesInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutRolesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutRolesInputSchema).optional(),
  upsert: z.lazy(() => OrganizationUpsertWithoutRolesInputSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => OrganizationUpdateToOneWithWhereWithoutRolesInputSchema),z.lazy(() => OrganizationUpdateWithoutRolesInputSchema),z.lazy(() => OrganizationUncheckedUpdateWithoutRolesInputSchema) ]).optional(),
}).strict();

export default OrganizationUpdateOneRequiredWithoutRolesNestedInputSchema;
