import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { PriorityCreateManyInputSchema } from '../inputTypeSchemas/PriorityCreateManyInputSchema'

export const PriorityCreateManyArgsSchema: z.ZodType<Prisma.PriorityCreateManyArgs> = z.object({
  data: z.union([ PriorityCreateManyInputSchema,PriorityCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export default PriorityCreateManyArgsSchema;
