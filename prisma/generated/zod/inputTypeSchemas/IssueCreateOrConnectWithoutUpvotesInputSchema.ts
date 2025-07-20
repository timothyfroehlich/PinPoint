import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';
import { IssueCreateWithoutUpvotesInputSchema } from './IssueCreateWithoutUpvotesInputSchema';
import { IssueUncheckedCreateWithoutUpvotesInputSchema } from './IssueUncheckedCreateWithoutUpvotesInputSchema';

export const IssueCreateOrConnectWithoutUpvotesInputSchema: z.ZodType<Prisma.IssueCreateOrConnectWithoutUpvotesInput> = z.object({
  where: z.lazy(() => IssueWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => IssueCreateWithoutUpvotesInputSchema),z.lazy(() => IssueUncheckedCreateWithoutUpvotesInputSchema) ]),
}).strict();

export default IssueCreateOrConnectWithoutUpvotesInputSchema;
