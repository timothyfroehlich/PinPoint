import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueScalarWhereInputSchema } from './IssueScalarWhereInputSchema';
import { IssueUpdateManyMutationInputSchema } from './IssueUpdateManyMutationInputSchema';
import { IssueUncheckedUpdateManyWithoutPriorityInputSchema } from './IssueUncheckedUpdateManyWithoutPriorityInputSchema';

export const IssueUpdateManyWithWhereWithoutPriorityInputSchema: z.ZodType<Prisma.IssueUpdateManyWithWhereWithoutPriorityInput> = z.object({
  where: z.lazy(() => IssueScalarWhereInputSchema),
  data: z.union([ z.lazy(() => IssueUpdateManyMutationInputSchema),z.lazy(() => IssueUncheckedUpdateManyWithoutPriorityInputSchema) ]),
}).strict();

export default IssueUpdateManyWithWhereWithoutPriorityInputSchema;
