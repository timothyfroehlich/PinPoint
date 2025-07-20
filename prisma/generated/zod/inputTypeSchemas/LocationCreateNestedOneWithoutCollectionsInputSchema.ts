import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { LocationCreateWithoutCollectionsInputSchema } from './LocationCreateWithoutCollectionsInputSchema';
import { LocationUncheckedCreateWithoutCollectionsInputSchema } from './LocationUncheckedCreateWithoutCollectionsInputSchema';
import { LocationCreateOrConnectWithoutCollectionsInputSchema } from './LocationCreateOrConnectWithoutCollectionsInputSchema';
import { LocationWhereUniqueInputSchema } from './LocationWhereUniqueInputSchema';

export const LocationCreateNestedOneWithoutCollectionsInputSchema: z.ZodType<Prisma.LocationCreateNestedOneWithoutCollectionsInput> = z.object({
  create: z.union([ z.lazy(() => LocationCreateWithoutCollectionsInputSchema),z.lazy(() => LocationUncheckedCreateWithoutCollectionsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => LocationCreateOrConnectWithoutCollectionsInputSchema).optional(),
  connect: z.lazy(() => LocationWhereUniqueInputSchema).optional()
}).strict();

export default LocationCreateNestedOneWithoutCollectionsInputSchema;
