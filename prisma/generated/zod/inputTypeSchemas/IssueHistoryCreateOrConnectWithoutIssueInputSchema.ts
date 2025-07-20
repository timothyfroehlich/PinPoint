import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueHistoryWhereUniqueInputSchema } from './IssueHistoryWhereUniqueInputSchema';
import { IssueHistoryCreateWithoutIssueInputSchema } from './IssueHistoryCreateWithoutIssueInputSchema';
import { IssueHistoryUncheckedCreateWithoutIssueInputSchema } from './IssueHistoryUncheckedCreateWithoutIssueInputSchema';

export const IssueHistoryCreateOrConnectWithoutIssueInputSchema: z.ZodType<Prisma.IssueHistoryCreateOrConnectWithoutIssueInput> = z.object({
  where: z.lazy(() => IssueHistoryWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => IssueHistoryCreateWithoutIssueInputSchema),z.lazy(() => IssueHistoryUncheckedCreateWithoutIssueInputSchema) ]),
}).strict();

export default IssueHistoryCreateOrConnectWithoutIssueInputSchema;
