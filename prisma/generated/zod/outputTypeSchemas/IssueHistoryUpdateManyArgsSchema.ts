import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { IssueHistoryUpdateManyMutationInputSchema } from '../inputTypeSchemas/IssueHistoryUpdateManyMutationInputSchema'
import { IssueHistoryUncheckedUpdateManyInputSchema } from '../inputTypeSchemas/IssueHistoryUncheckedUpdateManyInputSchema'
import { IssueHistoryWhereInputSchema } from '../inputTypeSchemas/IssueHistoryWhereInputSchema'

export const IssueHistoryUpdateManyArgsSchema: z.ZodType<Prisma.IssueHistoryUpdateManyArgs> = z.object({
  data: z.union([ IssueHistoryUpdateManyMutationInputSchema,IssueHistoryUncheckedUpdateManyInputSchema ]),
  where: IssueHistoryWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default IssueHistoryUpdateManyArgsSchema;
