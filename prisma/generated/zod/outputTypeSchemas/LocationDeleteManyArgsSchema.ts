import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { LocationWhereInputSchema } from '../inputTypeSchemas/LocationWhereInputSchema'

export const LocationDeleteManyArgsSchema: z.ZodType<Prisma.LocationDeleteManyArgs> = z.object({
  where: LocationWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default LocationDeleteManyArgsSchema;
