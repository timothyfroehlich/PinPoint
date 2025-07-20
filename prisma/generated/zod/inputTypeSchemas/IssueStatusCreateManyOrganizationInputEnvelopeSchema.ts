import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueStatusCreateManyOrganizationInputSchema } from './IssueStatusCreateManyOrganizationInputSchema';

export const IssueStatusCreateManyOrganizationInputEnvelopeSchema: z.ZodType<Prisma.IssueStatusCreateManyOrganizationInputEnvelope> = z.object({
  data: z.union([ z.lazy(() => IssueStatusCreateManyOrganizationInputSchema),z.lazy(() => IssueStatusCreateManyOrganizationInputSchema).array() ]),
  skipDuplicates: z.boolean().optional()
}).strict();

export default IssueStatusCreateManyOrganizationInputEnvelopeSchema;
