import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueHistoryCreateManyOrganizationInputSchema } from './IssueHistoryCreateManyOrganizationInputSchema';

export const IssueHistoryCreateManyOrganizationInputEnvelopeSchema: z.ZodType<Prisma.IssueHistoryCreateManyOrganizationInputEnvelope> = z.object({
  data: z.union([ z.lazy(() => IssueHistoryCreateManyOrganizationInputSchema),z.lazy(() => IssueHistoryCreateManyOrganizationInputSchema).array() ]),
  skipDuplicates: z.boolean().optional()
}).strict();

export default IssueHistoryCreateManyOrganizationInputEnvelopeSchema;
