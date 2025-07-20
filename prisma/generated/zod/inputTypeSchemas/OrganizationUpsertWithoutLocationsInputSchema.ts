import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationUpdateWithoutLocationsInputSchema } from './OrganizationUpdateWithoutLocationsInputSchema';
import { OrganizationUncheckedUpdateWithoutLocationsInputSchema } from './OrganizationUncheckedUpdateWithoutLocationsInputSchema';
import { OrganizationCreateWithoutLocationsInputSchema } from './OrganizationCreateWithoutLocationsInputSchema';
import { OrganizationUncheckedCreateWithoutLocationsInputSchema } from './OrganizationUncheckedCreateWithoutLocationsInputSchema';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';

export const OrganizationUpsertWithoutLocationsInputSchema: z.ZodType<Prisma.OrganizationUpsertWithoutLocationsInput> = z.object({
  update: z.union([ z.lazy(() => OrganizationUpdateWithoutLocationsInputSchema),z.lazy(() => OrganizationUncheckedUpdateWithoutLocationsInputSchema) ]),
  create: z.union([ z.lazy(() => OrganizationCreateWithoutLocationsInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutLocationsInputSchema) ]),
  where: z.lazy(() => OrganizationWhereInputSchema).optional()
}).strict();

export default OrganizationUpsertWithoutLocationsInputSchema;
