import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { LocationUpdateManyMutationInputSchema } from '../inputTypeSchemas/LocationUpdateManyMutationInputSchema'
import { LocationUncheckedUpdateManyInputSchema } from '../inputTypeSchemas/LocationUncheckedUpdateManyInputSchema'
import { LocationWhereInputSchema } from '../inputTypeSchemas/LocationWhereInputSchema'

export const LocationUpdateManyArgsSchema: z.ZodType<Prisma.LocationUpdateManyArgs> = z.object({
  data: z.union([ LocationUpdateManyMutationInputSchema,LocationUncheckedUpdateManyInputSchema ]),
  where: LocationWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default LocationUpdateManyArgsSchema;
