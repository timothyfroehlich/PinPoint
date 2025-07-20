import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationCreateWithoutLocationsInputSchema } from './OrganizationCreateWithoutLocationsInputSchema';
import { OrganizationUncheckedCreateWithoutLocationsInputSchema } from './OrganizationUncheckedCreateWithoutLocationsInputSchema';
import { OrganizationCreateOrConnectWithoutLocationsInputSchema } from './OrganizationCreateOrConnectWithoutLocationsInputSchema';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';

export const OrganizationCreateNestedOneWithoutLocationsInputSchema: z.ZodType<Prisma.OrganizationCreateNestedOneWithoutLocationsInput> = z.object({
  create: z.union([ z.lazy(() => OrganizationCreateWithoutLocationsInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutLocationsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutLocationsInputSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional()
}).strict();

export default OrganizationCreateNestedOneWithoutLocationsInputSchema;
