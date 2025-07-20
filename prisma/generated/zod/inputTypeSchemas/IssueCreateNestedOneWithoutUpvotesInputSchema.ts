import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateWithoutUpvotesInputSchema } from './IssueCreateWithoutUpvotesInputSchema';
import { IssueUncheckedCreateWithoutUpvotesInputSchema } from './IssueUncheckedCreateWithoutUpvotesInputSchema';
import { IssueCreateOrConnectWithoutUpvotesInputSchema } from './IssueCreateOrConnectWithoutUpvotesInputSchema';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';

export const IssueCreateNestedOneWithoutUpvotesInputSchema: z.ZodType<Prisma.IssueCreateNestedOneWithoutUpvotesInput> = z.object({
  create: z.union([ z.lazy(() => IssueCreateWithoutUpvotesInputSchema),z.lazy(() => IssueUncheckedCreateWithoutUpvotesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => IssueCreateOrConnectWithoutUpvotesInputSchema).optional(),
  connect: z.lazy(() => IssueWhereUniqueInputSchema).optional()
}).strict();

export default IssueCreateNestedOneWithoutUpvotesInputSchema;
