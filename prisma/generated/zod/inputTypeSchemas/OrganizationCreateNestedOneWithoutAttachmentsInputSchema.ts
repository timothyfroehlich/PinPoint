import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationCreateWithoutAttachmentsInputSchema } from './OrganizationCreateWithoutAttachmentsInputSchema';
import { OrganizationUncheckedCreateWithoutAttachmentsInputSchema } from './OrganizationUncheckedCreateWithoutAttachmentsInputSchema';
import { OrganizationCreateOrConnectWithoutAttachmentsInputSchema } from './OrganizationCreateOrConnectWithoutAttachmentsInputSchema';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';

export const OrganizationCreateNestedOneWithoutAttachmentsInputSchema: z.ZodType<Prisma.OrganizationCreateNestedOneWithoutAttachmentsInput> = z.object({
  create: z.union([ z.lazy(() => OrganizationCreateWithoutAttachmentsInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutAttachmentsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutAttachmentsInputSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional()
}).strict();

export default OrganizationCreateNestedOneWithoutAttachmentsInputSchema;
