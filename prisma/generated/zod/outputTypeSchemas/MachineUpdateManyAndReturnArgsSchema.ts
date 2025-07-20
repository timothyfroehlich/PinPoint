import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { MachineUpdateManyMutationInputSchema } from '../inputTypeSchemas/MachineUpdateManyMutationInputSchema'
import { MachineUncheckedUpdateManyInputSchema } from '../inputTypeSchemas/MachineUncheckedUpdateManyInputSchema'
import { MachineWhereInputSchema } from '../inputTypeSchemas/MachineWhereInputSchema'

export const MachineUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.MachineUpdateManyAndReturnArgs> = z.object({
  data: z.union([ MachineUpdateManyMutationInputSchema,MachineUncheckedUpdateManyInputSchema ]),
  where: MachineWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default MachineUpdateManyAndReturnArgsSchema;
