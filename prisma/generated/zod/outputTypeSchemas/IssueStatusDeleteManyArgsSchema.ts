import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { IssueStatusWhereInputSchema } from '../inputTypeSchemas/IssueStatusWhereInputSchema'

export const IssueStatusDeleteManyArgsSchema: z.ZodType<Prisma.IssueStatusDeleteManyArgs> = z.object({
  where: IssueStatusWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default IssueStatusDeleteManyArgsSchema;
