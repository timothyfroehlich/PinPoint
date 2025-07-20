import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueStatusCreateWithoutIssuesInputSchema } from './IssueStatusCreateWithoutIssuesInputSchema';
import { IssueStatusUncheckedCreateWithoutIssuesInputSchema } from './IssueStatusUncheckedCreateWithoutIssuesInputSchema';
import { IssueStatusCreateOrConnectWithoutIssuesInputSchema } from './IssueStatusCreateOrConnectWithoutIssuesInputSchema';
import { IssueStatusWhereUniqueInputSchema } from './IssueStatusWhereUniqueInputSchema';

export const IssueStatusCreateNestedOneWithoutIssuesInputSchema: z.ZodType<Prisma.IssueStatusCreateNestedOneWithoutIssuesInput> = z.object({
  create: z.union([ z.lazy(() => IssueStatusCreateWithoutIssuesInputSchema),z.lazy(() => IssueStatusUncheckedCreateWithoutIssuesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => IssueStatusCreateOrConnectWithoutIssuesInputSchema).optional(),
  connect: z.lazy(() => IssueStatusWhereUniqueInputSchema).optional()
}).strict();

export default IssueStatusCreateNestedOneWithoutIssuesInputSchema;
