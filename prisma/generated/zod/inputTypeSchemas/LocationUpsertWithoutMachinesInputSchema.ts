import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { LocationUpdateWithoutMachinesInputSchema } from './LocationUpdateWithoutMachinesInputSchema';
import { LocationUncheckedUpdateWithoutMachinesInputSchema } from './LocationUncheckedUpdateWithoutMachinesInputSchema';
import { LocationCreateWithoutMachinesInputSchema } from './LocationCreateWithoutMachinesInputSchema';
import { LocationUncheckedCreateWithoutMachinesInputSchema } from './LocationUncheckedCreateWithoutMachinesInputSchema';
import { LocationWhereInputSchema } from './LocationWhereInputSchema';

export const LocationUpsertWithoutMachinesInputSchema: z.ZodType<Prisma.LocationUpsertWithoutMachinesInput> = z.object({
  update: z.union([ z.lazy(() => LocationUpdateWithoutMachinesInputSchema),z.lazy(() => LocationUncheckedUpdateWithoutMachinesInputSchema) ]),
  create: z.union([ z.lazy(() => LocationCreateWithoutMachinesInputSchema),z.lazy(() => LocationUncheckedCreateWithoutMachinesInputSchema) ]),
  where: z.lazy(() => LocationWhereInputSchema).optional()
}).strict();

export default LocationUpsertWithoutMachinesInputSchema;
