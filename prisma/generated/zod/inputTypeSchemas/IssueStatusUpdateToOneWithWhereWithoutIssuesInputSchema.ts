import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueStatusWhereInputSchema } from './IssueStatusWhereInputSchema';
import { IssueStatusUpdateWithoutIssuesInputSchema } from './IssueStatusUpdateWithoutIssuesInputSchema';
import { IssueStatusUncheckedUpdateWithoutIssuesInputSchema } from './IssueStatusUncheckedUpdateWithoutIssuesInputSchema';

export const IssueStatusUpdateToOneWithWhereWithoutIssuesInputSchema: z.ZodType<Prisma.IssueStatusUpdateToOneWithWhereWithoutIssuesInput> = z.object({
  where: z.lazy(() => IssueStatusWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => IssueStatusUpdateWithoutIssuesInputSchema),z.lazy(() => IssueStatusUncheckedUpdateWithoutIssuesInputSchema) ]),
}).strict();

export default IssueStatusUpdateToOneWithWhereWithoutIssuesInputSchema;
