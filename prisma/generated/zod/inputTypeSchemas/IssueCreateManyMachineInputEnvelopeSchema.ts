import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateManyMachineInputSchema } from './IssueCreateManyMachineInputSchema';

export const IssueCreateManyMachineInputEnvelopeSchema: z.ZodType<Prisma.IssueCreateManyMachineInputEnvelope> = z.object({
  data: z.union([ z.lazy(() => IssueCreateManyMachineInputSchema),z.lazy(() => IssueCreateManyMachineInputSchema).array() ]),
  skipDuplicates: z.boolean().optional()
}).strict();

export default IssueCreateManyMachineInputEnvelopeSchema;
