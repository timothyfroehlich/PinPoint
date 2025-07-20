import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { LocationCountOutputTypeSelectSchema } from './LocationCountOutputTypeSelectSchema';

export const LocationCountOutputTypeArgsSchema: z.ZodType<Prisma.LocationCountOutputTypeDefaultArgs> = z.object({
  select: z.lazy(() => LocationCountOutputTypeSelectSchema).nullish(),
}).strict();

export default LocationCountOutputTypeSelectSchema;
