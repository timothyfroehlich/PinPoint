import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueUpdateWithoutCommentsInputSchema } from './IssueUpdateWithoutCommentsInputSchema';
import { IssueUncheckedUpdateWithoutCommentsInputSchema } from './IssueUncheckedUpdateWithoutCommentsInputSchema';
import { IssueCreateWithoutCommentsInputSchema } from './IssueCreateWithoutCommentsInputSchema';
import { IssueUncheckedCreateWithoutCommentsInputSchema } from './IssueUncheckedCreateWithoutCommentsInputSchema';
import { IssueWhereInputSchema } from './IssueWhereInputSchema';

export const IssueUpsertWithoutCommentsInputSchema: z.ZodType<Prisma.IssueUpsertWithoutCommentsInput> = z.object({
  update: z.union([ z.lazy(() => IssueUpdateWithoutCommentsInputSchema),z.lazy(() => IssueUncheckedUpdateWithoutCommentsInputSchema) ]),
  create: z.union([ z.lazy(() => IssueCreateWithoutCommentsInputSchema),z.lazy(() => IssueUncheckedCreateWithoutCommentsInputSchema) ]),
  where: z.lazy(() => IssueWhereInputSchema).optional()
}).strict();

export default IssueUpsertWithoutCommentsInputSchema;
