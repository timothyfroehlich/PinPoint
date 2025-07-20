import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueUpdateWithoutUpvotesInputSchema } from './IssueUpdateWithoutUpvotesInputSchema';
import { IssueUncheckedUpdateWithoutUpvotesInputSchema } from './IssueUncheckedUpdateWithoutUpvotesInputSchema';
import { IssueCreateWithoutUpvotesInputSchema } from './IssueCreateWithoutUpvotesInputSchema';
import { IssueUncheckedCreateWithoutUpvotesInputSchema } from './IssueUncheckedCreateWithoutUpvotesInputSchema';
import { IssueWhereInputSchema } from './IssueWhereInputSchema';

export const IssueUpsertWithoutUpvotesInputSchema: z.ZodType<Prisma.IssueUpsertWithoutUpvotesInput> = z.object({
  update: z.union([ z.lazy(() => IssueUpdateWithoutUpvotesInputSchema),z.lazy(() => IssueUncheckedUpdateWithoutUpvotesInputSchema) ]),
  create: z.union([ z.lazy(() => IssueCreateWithoutUpvotesInputSchema),z.lazy(() => IssueUncheckedCreateWithoutUpvotesInputSchema) ]),
  where: z.lazy(() => IssueWhereInputSchema).optional()
}).strict();

export default IssueUpsertWithoutUpvotesInputSchema;
