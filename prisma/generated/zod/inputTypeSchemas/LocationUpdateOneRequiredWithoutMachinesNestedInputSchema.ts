import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { LocationCreateWithoutMachinesInputSchema } from './LocationCreateWithoutMachinesInputSchema';
import { LocationUncheckedCreateWithoutMachinesInputSchema } from './LocationUncheckedCreateWithoutMachinesInputSchema';
import { LocationCreateOrConnectWithoutMachinesInputSchema } from './LocationCreateOrConnectWithoutMachinesInputSchema';
import { LocationUpsertWithoutMachinesInputSchema } from './LocationUpsertWithoutMachinesInputSchema';
import { LocationWhereUniqueInputSchema } from './LocationWhereUniqueInputSchema';
import { LocationUpdateToOneWithWhereWithoutMachinesInputSchema } from './LocationUpdateToOneWithWhereWithoutMachinesInputSchema';
import { LocationUpdateWithoutMachinesInputSchema } from './LocationUpdateWithoutMachinesInputSchema';
import { LocationUncheckedUpdateWithoutMachinesInputSchema } from './LocationUncheckedUpdateWithoutMachinesInputSchema';

export const LocationUpdateOneRequiredWithoutMachinesNestedInputSchema: z.ZodType<Prisma.LocationUpdateOneRequiredWithoutMachinesNestedInput> = z.object({
  create: z.union([ z.lazy(() => LocationCreateWithoutMachinesInputSchema),z.lazy(() => LocationUncheckedCreateWithoutMachinesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => LocationCreateOrConnectWithoutMachinesInputSchema).optional(),
  upsert: z.lazy(() => LocationUpsertWithoutMachinesInputSchema).optional(),
  connect: z.lazy(() => LocationWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => LocationUpdateToOneWithWhereWithoutMachinesInputSchema),z.lazy(() => LocationUpdateWithoutMachinesInputSchema),z.lazy(() => LocationUncheckedUpdateWithoutMachinesInputSchema) ]).optional(),
}).strict();

export default LocationUpdateOneRequiredWithoutMachinesNestedInputSchema;
