import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { IssueUpdateManyMutationInputSchema } from '../inputTypeSchemas/IssueUpdateManyMutationInputSchema'
import { IssueUncheckedUpdateManyInputSchema } from '../inputTypeSchemas/IssueUncheckedUpdateManyInputSchema'
import { IssueWhereInputSchema } from '../inputTypeSchemas/IssueWhereInputSchema'

export const IssueUpdateManyArgsSchema: z.ZodType<Prisma.IssueUpdateManyArgs> = z.object({
  data: z.union([ IssueUpdateManyMutationInputSchema,IssueUncheckedUpdateManyInputSchema ]),
  where: IssueWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default IssueUpdateManyArgsSchema;
