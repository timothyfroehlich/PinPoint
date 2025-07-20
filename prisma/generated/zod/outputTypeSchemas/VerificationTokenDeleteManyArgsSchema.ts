import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { VerificationTokenWhereInputSchema } from '../inputTypeSchemas/VerificationTokenWhereInputSchema'

export const VerificationTokenDeleteManyArgsSchema: z.ZodType<Prisma.VerificationTokenDeleteManyArgs> = z.object({
  where: VerificationTokenWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default VerificationTokenDeleteManyArgsSchema;
