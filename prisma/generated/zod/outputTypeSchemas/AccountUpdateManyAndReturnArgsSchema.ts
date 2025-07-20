import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { AccountUpdateManyMutationInputSchema } from '../inputTypeSchemas/AccountUpdateManyMutationInputSchema'
import { AccountUncheckedUpdateManyInputSchema } from '../inputTypeSchemas/AccountUncheckedUpdateManyInputSchema'
import { AccountWhereInputSchema } from '../inputTypeSchemas/AccountWhereInputSchema'

export const AccountUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.AccountUpdateManyAndReturnArgs> = z.object({
  data: z.union([ AccountUpdateManyMutationInputSchema,AccountUncheckedUpdateManyInputSchema ]),
  where: AccountWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default AccountUpdateManyAndReturnArgsSchema;
