import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { MachineCreateManyInputSchema } from '../inputTypeSchemas/MachineCreateManyInputSchema'

export const MachineCreateManyAndReturnArgsSchema: z.ZodType<Prisma.MachineCreateManyAndReturnArgs> = z.object({
  data: z.union([ MachineCreateManyInputSchema,MachineCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export default MachineCreateManyAndReturnArgsSchema;
