import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';
import { OrganizationCreateWithoutAttachmentsInputSchema } from './OrganizationCreateWithoutAttachmentsInputSchema';
import { OrganizationUncheckedCreateWithoutAttachmentsInputSchema } from './OrganizationUncheckedCreateWithoutAttachmentsInputSchema';

export const OrganizationCreateOrConnectWithoutAttachmentsInputSchema: z.ZodType<Prisma.OrganizationCreateOrConnectWithoutAttachmentsInput> = z.object({
  where: z.lazy(() => OrganizationWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => OrganizationCreateWithoutAttachmentsInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutAttachmentsInputSchema) ]),
}).strict();

export default OrganizationCreateOrConnectWithoutAttachmentsInputSchema;
