import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { AttachmentWhereUniqueInputSchema } from './AttachmentWhereUniqueInputSchema';
import { AttachmentUpdateWithoutOrganizationInputSchema } from './AttachmentUpdateWithoutOrganizationInputSchema';
import { AttachmentUncheckedUpdateWithoutOrganizationInputSchema } from './AttachmentUncheckedUpdateWithoutOrganizationInputSchema';

export const AttachmentUpdateWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.AttachmentUpdateWithWhereUniqueWithoutOrganizationInput> = z.object({
  where: z.lazy(() => AttachmentWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => AttachmentUpdateWithoutOrganizationInputSchema),z.lazy(() => AttachmentUncheckedUpdateWithoutOrganizationInputSchema) ]),
}).strict();

export default AttachmentUpdateWithWhereUniqueWithoutOrganizationInputSchema;
