import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueHistoryScalarWhereInputSchema } from './IssueHistoryScalarWhereInputSchema';
import { IssueHistoryUpdateManyMutationInputSchema } from './IssueHistoryUpdateManyMutationInputSchema';
import { IssueHistoryUncheckedUpdateManyWithoutActorInputSchema } from './IssueHistoryUncheckedUpdateManyWithoutActorInputSchema';

export const IssueHistoryUpdateManyWithWhereWithoutActorInputSchema: z.ZodType<Prisma.IssueHistoryUpdateManyWithWhereWithoutActorInput> = z.object({
  where: z.lazy(() => IssueHistoryScalarWhereInputSchema),
  data: z.union([ z.lazy(() => IssueHistoryUpdateManyMutationInputSchema),z.lazy(() => IssueHistoryUncheckedUpdateManyWithoutActorInputSchema) ]),
}).strict();

export default IssueHistoryUpdateManyWithWhereWithoutActorInputSchema;
