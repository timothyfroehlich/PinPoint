import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateManyPriorityInputSchema } from './IssueCreateManyPriorityInputSchema';

export const IssueCreateManyPriorityInputEnvelopeSchema: z.ZodType<Prisma.IssueCreateManyPriorityInputEnvelope> = z.object({
  data: z.union([ z.lazy(() => IssueCreateManyPriorityInputSchema),z.lazy(() => IssueCreateManyPriorityInputSchema).array() ]),
  skipDuplicates: z.boolean().optional()
}).strict();

export default IssueCreateManyPriorityInputEnvelopeSchema;
