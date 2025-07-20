import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueHistoryCreateManyIssueInputSchema } from './IssueHistoryCreateManyIssueInputSchema';

export const IssueHistoryCreateManyIssueInputEnvelopeSchema: z.ZodType<Prisma.IssueHistoryCreateManyIssueInputEnvelope> = z.object({
  data: z.union([ z.lazy(() => IssueHistoryCreateManyIssueInputSchema),z.lazy(() => IssueHistoryCreateManyIssueInputSchema).array() ]),
  skipDuplicates: z.boolean().optional()
}).strict();

export default IssueHistoryCreateManyIssueInputEnvelopeSchema;
