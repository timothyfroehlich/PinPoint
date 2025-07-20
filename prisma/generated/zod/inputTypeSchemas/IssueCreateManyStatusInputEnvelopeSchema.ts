import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateManyStatusInputSchema } from './IssueCreateManyStatusInputSchema';

export const IssueCreateManyStatusInputEnvelopeSchema: z.ZodType<Prisma.IssueCreateManyStatusInputEnvelope> = z.object({
  data: z.union([ z.lazy(() => IssueCreateManyStatusInputSchema),z.lazy(() => IssueCreateManyStatusInputSchema).array() ]),
  skipDuplicates: z.boolean().optional()
}).strict();

export default IssueCreateManyStatusInputEnvelopeSchema;
