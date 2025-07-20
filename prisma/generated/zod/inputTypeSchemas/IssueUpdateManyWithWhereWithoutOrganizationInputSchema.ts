import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueScalarWhereInputSchema } from './IssueScalarWhereInputSchema';
import { IssueUpdateManyMutationInputSchema } from './IssueUpdateManyMutationInputSchema';
import { IssueUncheckedUpdateManyWithoutOrganizationInputSchema } from './IssueUncheckedUpdateManyWithoutOrganizationInputSchema';

export const IssueUpdateManyWithWhereWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueUpdateManyWithWhereWithoutOrganizationInput> = z.object({
  where: z.lazy(() => IssueScalarWhereInputSchema),
  data: z.union([ z.lazy(() => IssueUpdateManyMutationInputSchema),z.lazy(() => IssueUncheckedUpdateManyWithoutOrganizationInputSchema) ]),
}).strict();

export default IssueUpdateManyWithWhereWithoutOrganizationInputSchema;
