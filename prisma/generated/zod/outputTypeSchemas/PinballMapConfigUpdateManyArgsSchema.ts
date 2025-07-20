import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { PinballMapConfigUpdateManyMutationInputSchema } from '../inputTypeSchemas/PinballMapConfigUpdateManyMutationInputSchema'
import { PinballMapConfigUncheckedUpdateManyInputSchema } from '../inputTypeSchemas/PinballMapConfigUncheckedUpdateManyInputSchema'
import { PinballMapConfigWhereInputSchema } from '../inputTypeSchemas/PinballMapConfigWhereInputSchema'

export const PinballMapConfigUpdateManyArgsSchema: z.ZodType<Prisma.PinballMapConfigUpdateManyArgs> = z.object({
  data: z.union([ PinballMapConfigUpdateManyMutationInputSchema,PinballMapConfigUncheckedUpdateManyInputSchema ]),
  where: PinballMapConfigWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default PinballMapConfigUpdateManyArgsSchema;
