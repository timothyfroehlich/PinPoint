import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { PriorityCountOutputTypeSelectSchema } from './PriorityCountOutputTypeSelectSchema';

export const PriorityCountOutputTypeArgsSchema: z.ZodType<Prisma.PriorityCountOutputTypeDefaultArgs> = z.object({
  select: z.lazy(() => PriorityCountOutputTypeSelectSchema).nullish(),
}).strict();

export default PriorityCountOutputTypeSelectSchema;
