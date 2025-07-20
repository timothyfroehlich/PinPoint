import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { LocationCreateWithoutMachinesInputSchema } from './LocationCreateWithoutMachinesInputSchema';
import { LocationUncheckedCreateWithoutMachinesInputSchema } from './LocationUncheckedCreateWithoutMachinesInputSchema';
import { LocationCreateOrConnectWithoutMachinesInputSchema } from './LocationCreateOrConnectWithoutMachinesInputSchema';
import { LocationWhereUniqueInputSchema } from './LocationWhereUniqueInputSchema';

export const LocationCreateNestedOneWithoutMachinesInputSchema: z.ZodType<Prisma.LocationCreateNestedOneWithoutMachinesInput> = z.object({
  create: z.union([ z.lazy(() => LocationCreateWithoutMachinesInputSchema),z.lazy(() => LocationUncheckedCreateWithoutMachinesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => LocationCreateOrConnectWithoutMachinesInputSchema).optional(),
  connect: z.lazy(() => LocationWhereUniqueInputSchema).optional()
}).strict();

export default LocationCreateNestedOneWithoutMachinesInputSchema;
