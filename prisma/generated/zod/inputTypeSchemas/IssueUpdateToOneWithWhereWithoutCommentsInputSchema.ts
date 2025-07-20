import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueWhereInputSchema } from './IssueWhereInputSchema';
import { IssueUpdateWithoutCommentsInputSchema } from './IssueUpdateWithoutCommentsInputSchema';
import { IssueUncheckedUpdateWithoutCommentsInputSchema } from './IssueUncheckedUpdateWithoutCommentsInputSchema';

export const IssueUpdateToOneWithWhereWithoutCommentsInputSchema: z.ZodType<Prisma.IssueUpdateToOneWithWhereWithoutCommentsInput> = z.object({
  where: z.lazy(() => IssueWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => IssueUpdateWithoutCommentsInputSchema),z.lazy(() => IssueUncheckedUpdateWithoutCommentsInputSchema) ]),
}).strict();

export default IssueUpdateToOneWithWhereWithoutCommentsInputSchema;
