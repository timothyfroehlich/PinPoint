import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { LocationCreateManyInputSchema } from '../inputTypeSchemas/LocationCreateManyInputSchema'

export const LocationCreateManyArgsSchema: z.ZodType<Prisma.LocationCreateManyArgs> = z.object({
  data: z.union([ LocationCreateManyInputSchema,LocationCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export default LocationCreateManyArgsSchema;
