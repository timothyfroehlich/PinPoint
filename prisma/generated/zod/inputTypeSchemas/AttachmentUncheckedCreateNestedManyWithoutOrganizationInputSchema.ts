import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { AttachmentCreateWithoutOrganizationInputSchema } from './AttachmentCreateWithoutOrganizationInputSchema';
import { AttachmentUncheckedCreateWithoutOrganizationInputSchema } from './AttachmentUncheckedCreateWithoutOrganizationInputSchema';
import { AttachmentCreateOrConnectWithoutOrganizationInputSchema } from './AttachmentCreateOrConnectWithoutOrganizationInputSchema';
import { AttachmentCreateManyOrganizationInputEnvelopeSchema } from './AttachmentCreateManyOrganizationInputEnvelopeSchema';
import { AttachmentWhereUniqueInputSchema } from './AttachmentWhereUniqueInputSchema';

export const AttachmentUncheckedCreateNestedManyWithoutOrganizationInputSchema: z.ZodType<Prisma.AttachmentUncheckedCreateNestedManyWithoutOrganizationInput> = z.object({
  create: z.union([ z.lazy(() => AttachmentCreateWithoutOrganizationInputSchema),z.lazy(() => AttachmentCreateWithoutOrganizationInputSchema).array(),z.lazy(() => AttachmentUncheckedCreateWithoutOrganizationInputSchema),z.lazy(() => AttachmentUncheckedCreateWithoutOrganizationInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => AttachmentCreateOrConnectWithoutOrganizationInputSchema),z.lazy(() => AttachmentCreateOrConnectWithoutOrganizationInputSchema).array() ]).optional(),
  createMany: z.lazy(() => AttachmentCreateManyOrganizationInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => AttachmentWhereUniqueInputSchema),z.lazy(() => AttachmentWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default AttachmentUncheckedCreateNestedManyWithoutOrganizationInputSchema;
