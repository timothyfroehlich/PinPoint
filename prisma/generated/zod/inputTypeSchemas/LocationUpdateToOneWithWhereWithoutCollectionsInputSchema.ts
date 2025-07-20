import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { LocationWhereInputSchema } from './LocationWhereInputSchema';
import { LocationUpdateWithoutCollectionsInputSchema } from './LocationUpdateWithoutCollectionsInputSchema';
import { LocationUncheckedUpdateWithoutCollectionsInputSchema } from './LocationUncheckedUpdateWithoutCollectionsInputSchema';

export const LocationUpdateToOneWithWhereWithoutCollectionsInputSchema: z.ZodType<Prisma.LocationUpdateToOneWithWhereWithoutCollectionsInput> = z.object({
  where: z.lazy(() => LocationWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => LocationUpdateWithoutCollectionsInputSchema),z.lazy(() => LocationUncheckedUpdateWithoutCollectionsInputSchema) ]),
}).strict();

export default LocationUpdateToOneWithWhereWithoutCollectionsInputSchema;
