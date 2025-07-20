import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueUpdateWithoutHistoryInputSchema } from './IssueUpdateWithoutHistoryInputSchema';
import { IssueUncheckedUpdateWithoutHistoryInputSchema } from './IssueUncheckedUpdateWithoutHistoryInputSchema';
import { IssueCreateWithoutHistoryInputSchema } from './IssueCreateWithoutHistoryInputSchema';
import { IssueUncheckedCreateWithoutHistoryInputSchema } from './IssueUncheckedCreateWithoutHistoryInputSchema';
import { IssueWhereInputSchema } from './IssueWhereInputSchema';

export const IssueUpsertWithoutHistoryInputSchema: z.ZodType<Prisma.IssueUpsertWithoutHistoryInput> = z.object({
  update: z.union([ z.lazy(() => IssueUpdateWithoutHistoryInputSchema),z.lazy(() => IssueUncheckedUpdateWithoutHistoryInputSchema) ]),
  create: z.union([ z.lazy(() => IssueCreateWithoutHistoryInputSchema),z.lazy(() => IssueUncheckedCreateWithoutHistoryInputSchema) ]),
  where: z.lazy(() => IssueWhereInputSchema).optional()
}).strict();

export default IssueUpsertWithoutHistoryInputSchema;
