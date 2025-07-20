import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueHistoryWhereUniqueInputSchema } from './IssueHistoryWhereUniqueInputSchema';
import { IssueHistoryUpdateWithoutOrganizationInputSchema } from './IssueHistoryUpdateWithoutOrganizationInputSchema';
import { IssueHistoryUncheckedUpdateWithoutOrganizationInputSchema } from './IssueHistoryUncheckedUpdateWithoutOrganizationInputSchema';
import { IssueHistoryCreateWithoutOrganizationInputSchema } from './IssueHistoryCreateWithoutOrganizationInputSchema';
import { IssueHistoryUncheckedCreateWithoutOrganizationInputSchema } from './IssueHistoryUncheckedCreateWithoutOrganizationInputSchema';

export const IssueHistoryUpsertWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueHistoryUpsertWithWhereUniqueWithoutOrganizationInput> = z.object({
  where: z.lazy(() => IssueHistoryWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => IssueHistoryUpdateWithoutOrganizationInputSchema),z.lazy(() => IssueHistoryUncheckedUpdateWithoutOrganizationInputSchema) ]),
  create: z.union([ z.lazy(() => IssueHistoryCreateWithoutOrganizationInputSchema),z.lazy(() => IssueHistoryUncheckedCreateWithoutOrganizationInputSchema) ]),
}).strict();

export default IssueHistoryUpsertWithWhereUniqueWithoutOrganizationInputSchema;
