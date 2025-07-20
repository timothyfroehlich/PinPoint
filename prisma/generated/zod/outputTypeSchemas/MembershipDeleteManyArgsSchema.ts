import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { MembershipWhereInputSchema } from '../inputTypeSchemas/MembershipWhereInputSchema'

export const MembershipDeleteManyArgsSchema: z.ZodType<Prisma.MembershipDeleteManyArgs> = z.object({
  where: MembershipWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default MembershipDeleteManyArgsSchema;
