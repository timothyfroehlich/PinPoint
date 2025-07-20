import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { IssueStatusUpdateManyMutationInputSchema } from '../inputTypeSchemas/IssueStatusUpdateManyMutationInputSchema'
import { IssueStatusUncheckedUpdateManyInputSchema } from '../inputTypeSchemas/IssueStatusUncheckedUpdateManyInputSchema'
import { IssueStatusWhereInputSchema } from '../inputTypeSchemas/IssueStatusWhereInputSchema'

export const IssueStatusUpdateManyArgsSchema: z.ZodType<Prisma.IssueStatusUpdateManyArgs> = z.object({
  data: z.union([ IssueStatusUpdateManyMutationInputSchema,IssueStatusUncheckedUpdateManyInputSchema ]),
  where: IssueStatusWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default IssueStatusUpdateManyArgsSchema;
