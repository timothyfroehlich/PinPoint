import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { MachineWhereInputSchema } from '../inputTypeSchemas/MachineWhereInputSchema'

export const MachineDeleteManyArgsSchema: z.ZodType<Prisma.MachineDeleteManyArgs> = z.object({
  where: MachineWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default MachineDeleteManyArgsSchema;
