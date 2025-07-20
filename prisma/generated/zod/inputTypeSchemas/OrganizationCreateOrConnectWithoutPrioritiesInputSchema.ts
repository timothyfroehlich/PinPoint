import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';
import { OrganizationCreateWithoutPrioritiesInputSchema } from './OrganizationCreateWithoutPrioritiesInputSchema';
import { OrganizationUncheckedCreateWithoutPrioritiesInputSchema } from './OrganizationUncheckedCreateWithoutPrioritiesInputSchema';

export const OrganizationCreateOrConnectWithoutPrioritiesInputSchema: z.ZodType<Prisma.OrganizationCreateOrConnectWithoutPrioritiesInput> = z.object({
  where: z.lazy(() => OrganizationWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => OrganizationCreateWithoutPrioritiesInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutPrioritiesInputSchema) ]),
}).strict();

export default OrganizationCreateOrConnectWithoutPrioritiesInputSchema;
