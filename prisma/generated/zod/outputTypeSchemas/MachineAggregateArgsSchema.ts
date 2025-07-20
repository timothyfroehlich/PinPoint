import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { MachineWhereInputSchema } from '../inputTypeSchemas/MachineWhereInputSchema'
import { MachineOrderByWithRelationInputSchema } from '../inputTypeSchemas/MachineOrderByWithRelationInputSchema'
import { MachineWhereUniqueInputSchema } from '../inputTypeSchemas/MachineWhereUniqueInputSchema'

export const MachineAggregateArgsSchema: z.ZodType<Prisma.MachineAggregateArgs> = z.object({
  where: MachineWhereInputSchema.optional(),
  orderBy: z.union([ MachineOrderByWithRelationInputSchema.array(),MachineOrderByWithRelationInputSchema ]).optional(),
  cursor: MachineWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export default MachineAggregateArgsSchema;
