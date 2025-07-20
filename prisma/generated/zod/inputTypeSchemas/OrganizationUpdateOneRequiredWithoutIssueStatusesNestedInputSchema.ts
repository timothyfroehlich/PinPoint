import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationCreateWithoutIssueStatusesInputSchema } from './OrganizationCreateWithoutIssueStatusesInputSchema';
import { OrganizationUncheckedCreateWithoutIssueStatusesInputSchema } from './OrganizationUncheckedCreateWithoutIssueStatusesInputSchema';
import { OrganizationCreateOrConnectWithoutIssueStatusesInputSchema } from './OrganizationCreateOrConnectWithoutIssueStatusesInputSchema';
import { OrganizationUpsertWithoutIssueStatusesInputSchema } from './OrganizationUpsertWithoutIssueStatusesInputSchema';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';
import { OrganizationUpdateToOneWithWhereWithoutIssueStatusesInputSchema } from './OrganizationUpdateToOneWithWhereWithoutIssueStatusesInputSchema';
import { OrganizationUpdateWithoutIssueStatusesInputSchema } from './OrganizationUpdateWithoutIssueStatusesInputSchema';
import { OrganizationUncheckedUpdateWithoutIssueStatusesInputSchema } from './OrganizationUncheckedUpdateWithoutIssueStatusesInputSchema';

export const OrganizationUpdateOneRequiredWithoutIssueStatusesNestedInputSchema: z.ZodType<Prisma.OrganizationUpdateOneRequiredWithoutIssueStatusesNestedInput> = z.object({
  create: z.union([ z.lazy(() => OrganizationCreateWithoutIssueStatusesInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutIssueStatusesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutIssueStatusesInputSchema).optional(),
  upsert: z.lazy(() => OrganizationUpsertWithoutIssueStatusesInputSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => OrganizationUpdateToOneWithWhereWithoutIssueStatusesInputSchema),z.lazy(() => OrganizationUpdateWithoutIssueStatusesInputSchema),z.lazy(() => OrganizationUncheckedUpdateWithoutIssueStatusesInputSchema) ]).optional(),
}).strict();

export default OrganizationUpdateOneRequiredWithoutIssueStatusesNestedInputSchema;
