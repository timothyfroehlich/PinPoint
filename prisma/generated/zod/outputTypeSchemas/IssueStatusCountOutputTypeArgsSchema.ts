import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { IssueStatusCountOutputTypeSelectSchema } from './IssueStatusCountOutputTypeSelectSchema';

export const IssueStatusCountOutputTypeArgsSchema: z.ZodType<Prisma.IssueStatusCountOutputTypeDefaultArgs> = z.object({
  select: z.lazy(() => IssueStatusCountOutputTypeSelectSchema).nullish(),
}).strict();

export default IssueStatusCountOutputTypeSelectSchema;
