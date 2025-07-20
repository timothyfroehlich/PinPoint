import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { IssueHistorySelectSchema } from '../inputTypeSchemas/IssueHistorySelectSchema';
import { IssueHistoryIncludeSchema } from '../inputTypeSchemas/IssueHistoryIncludeSchema';

export const IssueHistoryArgsSchema: z.ZodType<Prisma.IssueHistoryDefaultArgs> = z.object({
  select: z.lazy(() => IssueHistorySelectSchema).optional(),
  include: z.lazy(() => IssueHistoryIncludeSchema).optional(),
}).strict();

export default IssueHistoryArgsSchema;
