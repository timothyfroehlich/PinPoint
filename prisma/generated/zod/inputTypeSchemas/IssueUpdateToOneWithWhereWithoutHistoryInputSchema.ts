import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueWhereInputSchema } from './IssueWhereInputSchema';
import { IssueUpdateWithoutHistoryInputSchema } from './IssueUpdateWithoutHistoryInputSchema';
import { IssueUncheckedUpdateWithoutHistoryInputSchema } from './IssueUncheckedUpdateWithoutHistoryInputSchema';

export const IssueUpdateToOneWithWhereWithoutHistoryInputSchema: z.ZodType<Prisma.IssueUpdateToOneWithWhereWithoutHistoryInput> = z.object({
  where: z.lazy(() => IssueWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => IssueUpdateWithoutHistoryInputSchema),z.lazy(() => IssueUncheckedUpdateWithoutHistoryInputSchema) ]),
}).strict();

export default IssueUpdateToOneWithWhereWithoutHistoryInputSchema;
