import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { AttachmentScalarWhereInputSchema } from './AttachmentScalarWhereInputSchema';
import { AttachmentUpdateManyMutationInputSchema } from './AttachmentUpdateManyMutationInputSchema';
import { AttachmentUncheckedUpdateManyWithoutOrganizationInputSchema } from './AttachmentUncheckedUpdateManyWithoutOrganizationInputSchema';

export const AttachmentUpdateManyWithWhereWithoutOrganizationInputSchema: z.ZodType<Prisma.AttachmentUpdateManyWithWhereWithoutOrganizationInput> = z.object({
  where: z.lazy(() => AttachmentScalarWhereInputSchema),
  data: z.union([ z.lazy(() => AttachmentUpdateManyMutationInputSchema),z.lazy(() => AttachmentUncheckedUpdateManyWithoutOrganizationInputSchema) ]),
}).strict();

export default AttachmentUpdateManyWithWhereWithoutOrganizationInputSchema;
