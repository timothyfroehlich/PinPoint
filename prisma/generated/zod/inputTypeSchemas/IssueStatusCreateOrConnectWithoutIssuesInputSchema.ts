import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueStatusWhereUniqueInputSchema } from './IssueStatusWhereUniqueInputSchema';
import { IssueStatusCreateWithoutIssuesInputSchema } from './IssueStatusCreateWithoutIssuesInputSchema';
import { IssueStatusUncheckedCreateWithoutIssuesInputSchema } from './IssueStatusUncheckedCreateWithoutIssuesInputSchema';

export const IssueStatusCreateOrConnectWithoutIssuesInputSchema: z.ZodType<Prisma.IssueStatusCreateOrConnectWithoutIssuesInput> = z.object({
  where: z.lazy(() => IssueStatusWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => IssueStatusCreateWithoutIssuesInputSchema),z.lazy(() => IssueStatusUncheckedCreateWithoutIssuesInputSchema) ]),
}).strict();

export default IssueStatusCreateOrConnectWithoutIssuesInputSchema;
