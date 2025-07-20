import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';
import { OrganizationCreateWithoutIssueStatusesInputSchema } from './OrganizationCreateWithoutIssueStatusesInputSchema';
import { OrganizationUncheckedCreateWithoutIssueStatusesInputSchema } from './OrganizationUncheckedCreateWithoutIssueStatusesInputSchema';

export const OrganizationCreateOrConnectWithoutIssueStatusesInputSchema: z.ZodType<Prisma.OrganizationCreateOrConnectWithoutIssueStatusesInput> = z.object({
  where: z.lazy(() => OrganizationWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => OrganizationCreateWithoutIssueStatusesInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutIssueStatusesInputSchema) ]),
}).strict();

export default OrganizationCreateOrConnectWithoutIssueStatusesInputSchema;
