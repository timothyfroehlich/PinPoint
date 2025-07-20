import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { LocationScalarWhereInputSchema } from './LocationScalarWhereInputSchema';
import { LocationUpdateManyMutationInputSchema } from './LocationUpdateManyMutationInputSchema';
import { LocationUncheckedUpdateManyWithoutOrganizationInputSchema } from './LocationUncheckedUpdateManyWithoutOrganizationInputSchema';

export const LocationUpdateManyWithWhereWithoutOrganizationInputSchema: z.ZodType<Prisma.LocationUpdateManyWithWhereWithoutOrganizationInput> = z.object({
  where: z.lazy(() => LocationScalarWhereInputSchema),
  data: z.union([ z.lazy(() => LocationUpdateManyMutationInputSchema),z.lazy(() => LocationUncheckedUpdateManyWithoutOrganizationInputSchema) ]),
}).strict();

export default LocationUpdateManyWithWhereWithoutOrganizationInputSchema;
