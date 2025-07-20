import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { LocationWhereInputSchema } from './LocationWhereInputSchema';
import { LocationUpdateWithoutMachinesInputSchema } from './LocationUpdateWithoutMachinesInputSchema';
import { LocationUncheckedUpdateWithoutMachinesInputSchema } from './LocationUncheckedUpdateWithoutMachinesInputSchema';

export const LocationUpdateToOneWithWhereWithoutMachinesInputSchema: z.ZodType<Prisma.LocationUpdateToOneWithWhereWithoutMachinesInput> = z.object({
  where: z.lazy(() => LocationWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => LocationUpdateWithoutMachinesInputSchema),z.lazy(() => LocationUncheckedUpdateWithoutMachinesInputSchema) ]),
}).strict();

export default LocationUpdateToOneWithWhereWithoutMachinesInputSchema;
