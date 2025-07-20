import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { AttachmentWhereUniqueInputSchema } from './AttachmentWhereUniqueInputSchema';
import { AttachmentCreateWithoutOrganizationInputSchema } from './AttachmentCreateWithoutOrganizationInputSchema';
import { AttachmentUncheckedCreateWithoutOrganizationInputSchema } from './AttachmentUncheckedCreateWithoutOrganizationInputSchema';

export const AttachmentCreateOrConnectWithoutOrganizationInputSchema: z.ZodType<Prisma.AttachmentCreateOrConnectWithoutOrganizationInput> = z.object({
  where: z.lazy(() => AttachmentWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => AttachmentCreateWithoutOrganizationInputSchema),z.lazy(() => AttachmentUncheckedCreateWithoutOrganizationInputSchema) ]),
}).strict();

export default AttachmentCreateOrConnectWithoutOrganizationInputSchema;
