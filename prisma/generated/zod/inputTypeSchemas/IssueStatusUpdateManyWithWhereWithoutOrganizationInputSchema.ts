import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueStatusScalarWhereInputSchema } from './IssueStatusScalarWhereInputSchema';
import { IssueStatusUpdateManyMutationInputSchema } from './IssueStatusUpdateManyMutationInputSchema';
import { IssueStatusUncheckedUpdateManyWithoutOrganizationInputSchema } from './IssueStatusUncheckedUpdateManyWithoutOrganizationInputSchema';

export const IssueStatusUpdateManyWithWhereWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueStatusUpdateManyWithWhereWithoutOrganizationInput> = z.object({
  where: z.lazy(() => IssueStatusScalarWhereInputSchema),
  data: z.union([ z.lazy(() => IssueStatusUpdateManyMutationInputSchema),z.lazy(() => IssueStatusUncheckedUpdateManyWithoutOrganizationInputSchema) ]),
}).strict();

export default IssueStatusUpdateManyWithWhereWithoutOrganizationInputSchema;
