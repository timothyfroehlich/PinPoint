import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { IssueCreateManyInputSchema } from '../inputTypeSchemas/IssueCreateManyInputSchema'

export const IssueCreateManyArgsSchema: z.ZodType<Prisma.IssueCreateManyArgs> = z.object({
  data: z.union([ IssueCreateManyInputSchema,IssueCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export default IssueCreateManyArgsSchema;
