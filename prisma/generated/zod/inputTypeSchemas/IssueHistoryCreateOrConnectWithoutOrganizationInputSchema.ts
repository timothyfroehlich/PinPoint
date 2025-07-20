import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueHistoryWhereUniqueInputSchema } from './IssueHistoryWhereUniqueInputSchema';
import { IssueHistoryCreateWithoutOrganizationInputSchema } from './IssueHistoryCreateWithoutOrganizationInputSchema';
import { IssueHistoryUncheckedCreateWithoutOrganizationInputSchema } from './IssueHistoryUncheckedCreateWithoutOrganizationInputSchema';

export const IssueHistoryCreateOrConnectWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueHistoryCreateOrConnectWithoutOrganizationInput> = z.object({
  where: z.lazy(() => IssueHistoryWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => IssueHistoryCreateWithoutOrganizationInputSchema),z.lazy(() => IssueHistoryUncheckedCreateWithoutOrganizationInputSchema) ]),
}).strict();

export default IssueHistoryCreateOrConnectWithoutOrganizationInputSchema;
