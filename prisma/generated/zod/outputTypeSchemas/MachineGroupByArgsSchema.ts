import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { MachineWhereInputSchema } from '../inputTypeSchemas/MachineWhereInputSchema'
import { MachineOrderByWithAggregationInputSchema } from '../inputTypeSchemas/MachineOrderByWithAggregationInputSchema'
import { MachineScalarFieldEnumSchema } from '../inputTypeSchemas/MachineScalarFieldEnumSchema'
import { MachineScalarWhereWithAggregatesInputSchema } from '../inputTypeSchemas/MachineScalarWhereWithAggregatesInputSchema'

export const MachineGroupByArgsSchema: z.ZodType<Prisma.MachineGroupByArgs> = z.object({
  where: MachineWhereInputSchema.optional(),
  orderBy: z.union([ MachineOrderByWithAggregationInputSchema.array(),MachineOrderByWithAggregationInputSchema ]).optional(),
  by: MachineScalarFieldEnumSchema.array(),
  having: MachineScalarWhereWithAggregatesInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export default MachineGroupByArgsSchema;
