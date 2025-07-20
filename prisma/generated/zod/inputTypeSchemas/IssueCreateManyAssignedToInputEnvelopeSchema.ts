import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateManyAssignedToInputSchema } from './IssueCreateManyAssignedToInputSchema';

export const IssueCreateManyAssignedToInputEnvelopeSchema: z.ZodType<Prisma.IssueCreateManyAssignedToInputEnvelope> = z.object({
  data: z.union([ z.lazy(() => IssueCreateManyAssignedToInputSchema),z.lazy(() => IssueCreateManyAssignedToInputSchema).array() ]),
  skipDuplicates: z.boolean().optional()
}).strict();

export default IssueCreateManyAssignedToInputEnvelopeSchema;
