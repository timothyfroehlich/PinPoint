import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';
import { IssueUpdateWithoutPriorityInputSchema } from './IssueUpdateWithoutPriorityInputSchema';
import { IssueUncheckedUpdateWithoutPriorityInputSchema } from './IssueUncheckedUpdateWithoutPriorityInputSchema';

export const IssueUpdateWithWhereUniqueWithoutPriorityInputSchema: z.ZodType<Prisma.IssueUpdateWithWhereUniqueWithoutPriorityInput> = z.object({
  where: z.lazy(() => IssueWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => IssueUpdateWithoutPriorityInputSchema),z.lazy(() => IssueUncheckedUpdateWithoutPriorityInputSchema) ]),
}).strict();

export default IssueUpdateWithWhereUniqueWithoutPriorityInputSchema;
