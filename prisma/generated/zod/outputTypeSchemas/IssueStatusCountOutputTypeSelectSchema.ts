import { z } from 'zod';
import type { Prisma } from '@prisma/client';

export const IssueStatusCountOutputTypeSelectSchema: z.ZodType<Prisma.IssueStatusCountOutputTypeSelect> = z.object({
  issues: z.boolean().optional(),
}).strict();

export default IssueStatusCountOutputTypeSelectSchema;
