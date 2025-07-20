import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueHistoryScalarWhereInputSchema } from './IssueHistoryScalarWhereInputSchema';
import { IssueHistoryUpdateManyMutationInputSchema } from './IssueHistoryUpdateManyMutationInputSchema';
import { IssueHistoryUncheckedUpdateManyWithoutOrganizationInputSchema } from './IssueHistoryUncheckedUpdateManyWithoutOrganizationInputSchema';

export const IssueHistoryUpdateManyWithWhereWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueHistoryUpdateManyWithWhereWithoutOrganizationInput> = z.object({
  where: z.lazy(() => IssueHistoryScalarWhereInputSchema),
  data: z.union([ z.lazy(() => IssueHistoryUpdateManyMutationInputSchema),z.lazy(() => IssueHistoryUncheckedUpdateManyWithoutOrganizationInputSchema) ]),
}).strict();

export default IssueHistoryUpdateManyWithWhereWithoutOrganizationInputSchema;
