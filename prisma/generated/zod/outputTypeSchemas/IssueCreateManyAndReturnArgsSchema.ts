import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { IssueCreateManyInputSchema } from '../inputTypeSchemas/IssueCreateManyInputSchema'

export const IssueCreateManyAndReturnArgsSchema: z.ZodType<Prisma.IssueCreateManyAndReturnArgs> = z.object({
  data: z.union([ IssueCreateManyInputSchema,IssueCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export default IssueCreateManyAndReturnArgsSchema;
