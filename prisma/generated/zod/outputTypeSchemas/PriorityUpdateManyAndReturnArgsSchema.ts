import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { PriorityUpdateManyMutationInputSchema } from '../inputTypeSchemas/PriorityUpdateManyMutationInputSchema'
import { PriorityUncheckedUpdateManyInputSchema } from '../inputTypeSchemas/PriorityUncheckedUpdateManyInputSchema'
import { PriorityWhereInputSchema } from '../inputTypeSchemas/PriorityWhereInputSchema'

export const PriorityUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.PriorityUpdateManyAndReturnArgs> = z.object({
  data: z.union([ PriorityUpdateManyMutationInputSchema,PriorityUncheckedUpdateManyInputSchema ]),
  where: PriorityWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default PriorityUpdateManyAndReturnArgsSchema;
