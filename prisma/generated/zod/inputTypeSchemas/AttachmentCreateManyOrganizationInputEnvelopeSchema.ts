import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { AttachmentCreateManyOrganizationInputSchema } from './AttachmentCreateManyOrganizationInputSchema';

export const AttachmentCreateManyOrganizationInputEnvelopeSchema: z.ZodType<Prisma.AttachmentCreateManyOrganizationInputEnvelope> = z.object({
  data: z.union([ z.lazy(() => AttachmentCreateManyOrganizationInputSchema),z.lazy(() => AttachmentCreateManyOrganizationInputSchema).array() ]),
  skipDuplicates: z.boolean().optional()
}).strict();

export default AttachmentCreateManyOrganizationInputEnvelopeSchema;
