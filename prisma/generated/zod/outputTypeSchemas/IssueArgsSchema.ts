import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { IssueSelectSchema } from '../inputTypeSchemas/IssueSelectSchema';
import { IssueIncludeSchema } from '../inputTypeSchemas/IssueIncludeSchema';

export const IssueArgsSchema: z.ZodType<Prisma.IssueDefaultArgs> = z.object({
  select: z.lazy(() => IssueSelectSchema).optional(),
  include: z.lazy(() => IssueIncludeSchema).optional(),
}).strict();

export default IssueArgsSchema;
