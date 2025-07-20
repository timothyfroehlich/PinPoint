import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationCreateWithoutMachinesInputSchema } from './OrganizationCreateWithoutMachinesInputSchema';
import { OrganizationUncheckedCreateWithoutMachinesInputSchema } from './OrganizationUncheckedCreateWithoutMachinesInputSchema';
import { OrganizationCreateOrConnectWithoutMachinesInputSchema } from './OrganizationCreateOrConnectWithoutMachinesInputSchema';
import { OrganizationUpsertWithoutMachinesInputSchema } from './OrganizationUpsertWithoutMachinesInputSchema';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';
import { OrganizationUpdateToOneWithWhereWithoutMachinesInputSchema } from './OrganizationUpdateToOneWithWhereWithoutMachinesInputSchema';
import { OrganizationUpdateWithoutMachinesInputSchema } from './OrganizationUpdateWithoutMachinesInputSchema';
import { OrganizationUncheckedUpdateWithoutMachinesInputSchema } from './OrganizationUncheckedUpdateWithoutMachinesInputSchema';

export const OrganizationUpdateOneRequiredWithoutMachinesNestedInputSchema: z.ZodType<Prisma.OrganizationUpdateOneRequiredWithoutMachinesNestedInput> = z.object({
  create: z.union([ z.lazy(() => OrganizationCreateWithoutMachinesInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutMachinesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutMachinesInputSchema).optional(),
  upsert: z.lazy(() => OrganizationUpsertWithoutMachinesInputSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => OrganizationUpdateToOneWithWhereWithoutMachinesInputSchema),z.lazy(() => OrganizationUpdateWithoutMachinesInputSchema),z.lazy(() => OrganizationUncheckedUpdateWithoutMachinesInputSchema) ]).optional(),
}).strict();

export default OrganizationUpdateOneRequiredWithoutMachinesNestedInputSchema;
