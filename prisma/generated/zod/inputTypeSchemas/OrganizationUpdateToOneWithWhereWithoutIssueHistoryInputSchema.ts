import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';
import { OrganizationUpdateWithoutIssueHistoryInputSchema } from './OrganizationUpdateWithoutIssueHistoryInputSchema';
import { OrganizationUncheckedUpdateWithoutIssueHistoryInputSchema } from './OrganizationUncheckedUpdateWithoutIssueHistoryInputSchema';

export const OrganizationUpdateToOneWithWhereWithoutIssueHistoryInputSchema: z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutIssueHistoryInput> = z.object({
  where: z.lazy(() => OrganizationWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => OrganizationUpdateWithoutIssueHistoryInputSchema),z.lazy(() => OrganizationUncheckedUpdateWithoutIssueHistoryInputSchema) ]),
}).strict();

export default OrganizationUpdateToOneWithWhereWithoutIssueHistoryInputSchema;
