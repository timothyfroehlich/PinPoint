import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { AttachmentWhereUniqueInputSchema } from './AttachmentWhereUniqueInputSchema';
import { AttachmentUpdateWithoutOrganizationInputSchema } from './AttachmentUpdateWithoutOrganizationInputSchema';
import { AttachmentUncheckedUpdateWithoutOrganizationInputSchema } from './AttachmentUncheckedUpdateWithoutOrganizationInputSchema';
import { AttachmentCreateWithoutOrganizationInputSchema } from './AttachmentCreateWithoutOrganizationInputSchema';
import { AttachmentUncheckedCreateWithoutOrganizationInputSchema } from './AttachmentUncheckedCreateWithoutOrganizationInputSchema';

export const AttachmentUpsertWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.AttachmentUpsertWithWhereUniqueWithoutOrganizationInput> = z.object({
  where: z.lazy(() => AttachmentWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => AttachmentUpdateWithoutOrganizationInputSchema),z.lazy(() => AttachmentUncheckedUpdateWithoutOrganizationInputSchema) ]),
  create: z.union([ z.lazy(() => AttachmentCreateWithoutOrganizationInputSchema),z.lazy(() => AttachmentUncheckedCreateWithoutOrganizationInputSchema) ]),
}).strict();

export default AttachmentUpsertWithWhereUniqueWithoutOrganizationInputSchema;
