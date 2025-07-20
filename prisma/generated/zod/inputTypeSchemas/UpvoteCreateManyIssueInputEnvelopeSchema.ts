import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UpvoteCreateManyIssueInputSchema } from './UpvoteCreateManyIssueInputSchema';

export const UpvoteCreateManyIssueInputEnvelopeSchema: z.ZodType<Prisma.UpvoteCreateManyIssueInputEnvelope> = z.object({
  data: z.union([ z.lazy(() => UpvoteCreateManyIssueInputSchema),z.lazy(() => UpvoteCreateManyIssueInputSchema).array() ]),
  skipDuplicates: z.boolean().optional()
}).strict();

export default UpvoteCreateManyIssueInputEnvelopeSchema;
