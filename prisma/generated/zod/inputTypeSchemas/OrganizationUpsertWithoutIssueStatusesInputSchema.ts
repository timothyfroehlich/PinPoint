import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationUpdateWithoutIssueStatusesInputSchema } from './OrganizationUpdateWithoutIssueStatusesInputSchema';
import { OrganizationUncheckedUpdateWithoutIssueStatusesInputSchema } from './OrganizationUncheckedUpdateWithoutIssueStatusesInputSchema';
import { OrganizationCreateWithoutIssueStatusesInputSchema } from './OrganizationCreateWithoutIssueStatusesInputSchema';
import { OrganizationUncheckedCreateWithoutIssueStatusesInputSchema } from './OrganizationUncheckedCreateWithoutIssueStatusesInputSchema';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';

export const OrganizationUpsertWithoutIssueStatusesInputSchema: z.ZodType<Prisma.OrganizationUpsertWithoutIssueStatusesInput> = z.object({
  update: z.union([ z.lazy(() => OrganizationUpdateWithoutIssueStatusesInputSchema),z.lazy(() => OrganizationUncheckedUpdateWithoutIssueStatusesInputSchema) ]),
  create: z.union([ z.lazy(() => OrganizationCreateWithoutIssueStatusesInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutIssueStatusesInputSchema) ]),
  where: z.lazy(() => OrganizationWhereInputSchema).optional()
}).strict();

export default OrganizationUpsertWithoutIssueStatusesInputSchema;
