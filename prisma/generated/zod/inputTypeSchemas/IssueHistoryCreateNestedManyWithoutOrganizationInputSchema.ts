import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueHistoryCreateWithoutOrganizationInputSchema } from './IssueHistoryCreateWithoutOrganizationInputSchema';
import { IssueHistoryUncheckedCreateWithoutOrganizationInputSchema } from './IssueHistoryUncheckedCreateWithoutOrganizationInputSchema';
import { IssueHistoryCreateOrConnectWithoutOrganizationInputSchema } from './IssueHistoryCreateOrConnectWithoutOrganizationInputSchema';
import { IssueHistoryCreateManyOrganizationInputEnvelopeSchema } from './IssueHistoryCreateManyOrganizationInputEnvelopeSchema';
import { IssueHistoryWhereUniqueInputSchema } from './IssueHistoryWhereUniqueInputSchema';

export const IssueHistoryCreateNestedManyWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueHistoryCreateNestedManyWithoutOrganizationInput> = z.object({
  create: z.union([ z.lazy(() => IssueHistoryCreateWithoutOrganizationInputSchema),z.lazy(() => IssueHistoryCreateWithoutOrganizationInputSchema).array(),z.lazy(() => IssueHistoryUncheckedCreateWithoutOrganizationInputSchema),z.lazy(() => IssueHistoryUncheckedCreateWithoutOrganizationInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => IssueHistoryCreateOrConnectWithoutOrganizationInputSchema),z.lazy(() => IssueHistoryCreateOrConnectWithoutOrganizationInputSchema).array() ]).optional(),
  createMany: z.lazy(() => IssueHistoryCreateManyOrganizationInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => IssueHistoryWhereUniqueInputSchema),z.lazy(() => IssueHistoryWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default IssueHistoryCreateNestedManyWithoutOrganizationInputSchema;
