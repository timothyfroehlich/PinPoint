import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { VerificationTokenUpdateManyMutationInputSchema } from '../inputTypeSchemas/VerificationTokenUpdateManyMutationInputSchema'
import { VerificationTokenUncheckedUpdateManyInputSchema } from '../inputTypeSchemas/VerificationTokenUncheckedUpdateManyInputSchema'
import { VerificationTokenWhereInputSchema } from '../inputTypeSchemas/VerificationTokenWhereInputSchema'

export const VerificationTokenUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.VerificationTokenUpdateManyAndReturnArgs> = z.object({
  data: z.union([ VerificationTokenUpdateManyMutationInputSchema,VerificationTokenUncheckedUpdateManyInputSchema ]),
  where: VerificationTokenWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default VerificationTokenUpdateManyAndReturnArgsSchema;
