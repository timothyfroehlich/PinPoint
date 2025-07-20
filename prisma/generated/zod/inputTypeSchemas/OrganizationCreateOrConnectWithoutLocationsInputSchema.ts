import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';
import { OrganizationCreateWithoutLocationsInputSchema } from './OrganizationCreateWithoutLocationsInputSchema';
import { OrganizationUncheckedCreateWithoutLocationsInputSchema } from './OrganizationUncheckedCreateWithoutLocationsInputSchema';

export const OrganizationCreateOrConnectWithoutLocationsInputSchema: z.ZodType<Prisma.OrganizationCreateOrConnectWithoutLocationsInput> = z.object({
  where: z.lazy(() => OrganizationWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => OrganizationCreateWithoutLocationsInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutLocationsInputSchema) ]),
}).strict();

export default OrganizationCreateOrConnectWithoutLocationsInputSchema;
