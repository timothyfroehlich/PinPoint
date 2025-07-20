import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueHistoryWhereUniqueInputSchema } from './IssueHistoryWhereUniqueInputSchema';
import { IssueHistoryUpdateWithoutIssueInputSchema } from './IssueHistoryUpdateWithoutIssueInputSchema';
import { IssueHistoryUncheckedUpdateWithoutIssueInputSchema } from './IssueHistoryUncheckedUpdateWithoutIssueInputSchema';

export const IssueHistoryUpdateWithWhereUniqueWithoutIssueInputSchema: z.ZodType<Prisma.IssueHistoryUpdateWithWhereUniqueWithoutIssueInput> = z.object({
  where: z.lazy(() => IssueHistoryWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => IssueHistoryUpdateWithoutIssueInputSchema),z.lazy(() => IssueHistoryUncheckedUpdateWithoutIssueInputSchema) ]),
}).strict();

export default IssueHistoryUpdateWithWhereUniqueWithoutIssueInputSchema;
