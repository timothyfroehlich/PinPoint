import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueStatusUpdateWithoutIssuesInputSchema } from './IssueStatusUpdateWithoutIssuesInputSchema';
import { IssueStatusUncheckedUpdateWithoutIssuesInputSchema } from './IssueStatusUncheckedUpdateWithoutIssuesInputSchema';
import { IssueStatusCreateWithoutIssuesInputSchema } from './IssueStatusCreateWithoutIssuesInputSchema';
import { IssueStatusUncheckedCreateWithoutIssuesInputSchema } from './IssueStatusUncheckedCreateWithoutIssuesInputSchema';
import { IssueStatusWhereInputSchema } from './IssueStatusWhereInputSchema';

export const IssueStatusUpsertWithoutIssuesInputSchema: z.ZodType<Prisma.IssueStatusUpsertWithoutIssuesInput> = z.object({
  update: z.union([ z.lazy(() => IssueStatusUpdateWithoutIssuesInputSchema),z.lazy(() => IssueStatusUncheckedUpdateWithoutIssuesInputSchema) ]),
  create: z.union([ z.lazy(() => IssueStatusCreateWithoutIssuesInputSchema),z.lazy(() => IssueStatusUncheckedCreateWithoutIssuesInputSchema) ]),
  where: z.lazy(() => IssueStatusWhereInputSchema).optional()
}).strict();

export default IssueStatusUpsertWithoutIssuesInputSchema;
