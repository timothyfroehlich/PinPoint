import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationCreateWithoutIssueHistoryInputSchema } from './OrganizationCreateWithoutIssueHistoryInputSchema';
import { OrganizationUncheckedCreateWithoutIssueHistoryInputSchema } from './OrganizationUncheckedCreateWithoutIssueHistoryInputSchema';
import { OrganizationCreateOrConnectWithoutIssueHistoryInputSchema } from './OrganizationCreateOrConnectWithoutIssueHistoryInputSchema';
import { OrganizationUpsertWithoutIssueHistoryInputSchema } from './OrganizationUpsertWithoutIssueHistoryInputSchema';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';
import { OrganizationUpdateToOneWithWhereWithoutIssueHistoryInputSchema } from './OrganizationUpdateToOneWithWhereWithoutIssueHistoryInputSchema';
import { OrganizationUpdateWithoutIssueHistoryInputSchema } from './OrganizationUpdateWithoutIssueHistoryInputSchema';
import { OrganizationUncheckedUpdateWithoutIssueHistoryInputSchema } from './OrganizationUncheckedUpdateWithoutIssueHistoryInputSchema';

export const OrganizationUpdateOneRequiredWithoutIssueHistoryNestedInputSchema: z.ZodType<Prisma.OrganizationUpdateOneRequiredWithoutIssueHistoryNestedInput> = z.object({
  create: z.union([ z.lazy(() => OrganizationCreateWithoutIssueHistoryInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutIssueHistoryInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutIssueHistoryInputSchema).optional(),
  upsert: z.lazy(() => OrganizationUpsertWithoutIssueHistoryInputSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => OrganizationUpdateToOneWithWhereWithoutIssueHistoryInputSchema),z.lazy(() => OrganizationUpdateWithoutIssueHistoryInputSchema),z.lazy(() => OrganizationUncheckedUpdateWithoutIssueHistoryInputSchema) ]).optional(),
}).strict();

export default OrganizationUpdateOneRequiredWithoutIssueHistoryNestedInputSchema;
