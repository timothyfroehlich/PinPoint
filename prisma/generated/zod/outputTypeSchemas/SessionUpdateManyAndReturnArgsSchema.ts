import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { SessionUpdateManyMutationInputSchema } from '../inputTypeSchemas/SessionUpdateManyMutationInputSchema'
import { SessionUncheckedUpdateManyInputSchema } from '../inputTypeSchemas/SessionUncheckedUpdateManyInputSchema'
import { SessionWhereInputSchema } from '../inputTypeSchemas/SessionWhereInputSchema'

export const SessionUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.SessionUpdateManyAndReturnArgs> = z.object({
  data: z.union([ SessionUpdateManyMutationInputSchema,SessionUncheckedUpdateManyInputSchema ]),
  where: SessionWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default SessionUpdateManyAndReturnArgsSchema;
