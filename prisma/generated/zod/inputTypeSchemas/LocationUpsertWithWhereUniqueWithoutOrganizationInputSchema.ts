import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { LocationWhereUniqueInputSchema } from './LocationWhereUniqueInputSchema';
import { LocationUpdateWithoutOrganizationInputSchema } from './LocationUpdateWithoutOrganizationInputSchema';
import { LocationUncheckedUpdateWithoutOrganizationInputSchema } from './LocationUncheckedUpdateWithoutOrganizationInputSchema';
import { LocationCreateWithoutOrganizationInputSchema } from './LocationCreateWithoutOrganizationInputSchema';
import { LocationUncheckedCreateWithoutOrganizationInputSchema } from './LocationUncheckedCreateWithoutOrganizationInputSchema';

export const LocationUpsertWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.LocationUpsertWithWhereUniqueWithoutOrganizationInput> = z.object({
  where: z.lazy(() => LocationWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => LocationUpdateWithoutOrganizationInputSchema),z.lazy(() => LocationUncheckedUpdateWithoutOrganizationInputSchema) ]),
  create: z.union([ z.lazy(() => LocationCreateWithoutOrganizationInputSchema),z.lazy(() => LocationUncheckedCreateWithoutOrganizationInputSchema) ]),
}).strict();

export default LocationUpsertWithWhereUniqueWithoutOrganizationInputSchema;
