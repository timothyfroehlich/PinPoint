import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { MembershipCreateManyInputSchema } from '../inputTypeSchemas/MembershipCreateManyInputSchema'

export const MembershipCreateManyArgsSchema: z.ZodType<Prisma.MembershipCreateManyArgs> = z.object({
  data: z.union([ MembershipCreateManyInputSchema,MembershipCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export default MembershipCreateManyArgsSchema;
