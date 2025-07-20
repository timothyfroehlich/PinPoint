import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { IssueHistoryWhereInputSchema } from '../inputTypeSchemas/IssueHistoryWhereInputSchema'

export const IssueHistoryDeleteManyArgsSchema: z.ZodType<Prisma.IssueHistoryDeleteManyArgs> = z.object({
  where: IssueHistoryWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default IssueHistoryDeleteManyArgsSchema;
