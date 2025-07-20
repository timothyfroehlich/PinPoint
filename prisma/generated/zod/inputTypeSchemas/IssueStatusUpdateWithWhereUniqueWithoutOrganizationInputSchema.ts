import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueStatusWhereUniqueInputSchema } from './IssueStatusWhereUniqueInputSchema';
import { IssueStatusUpdateWithoutOrganizationInputSchema } from './IssueStatusUpdateWithoutOrganizationInputSchema';
import { IssueStatusUncheckedUpdateWithoutOrganizationInputSchema } from './IssueStatusUncheckedUpdateWithoutOrganizationInputSchema';

export const IssueStatusUpdateWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueStatusUpdateWithWhereUniqueWithoutOrganizationInput> = z.object({
  where: z.lazy(() => IssueStatusWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => IssueStatusUpdateWithoutOrganizationInputSchema),z.lazy(() => IssueStatusUncheckedUpdateWithoutOrganizationInputSchema) ]),
}).strict();

export default IssueStatusUpdateWithWhereUniqueWithoutOrganizationInputSchema;
