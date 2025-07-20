import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { PinballMapConfigCreateManyInputSchema } from '../inputTypeSchemas/PinballMapConfigCreateManyInputSchema'

export const PinballMapConfigCreateManyAndReturnArgsSchema: z.ZodType<Prisma.PinballMapConfigCreateManyAndReturnArgs> = z.object({
  data: z.union([ PinballMapConfigCreateManyInputSchema,PinballMapConfigCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export default PinballMapConfigCreateManyAndReturnArgsSchema;
