import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationCreateWithoutAttachmentsInputSchema } from './OrganizationCreateWithoutAttachmentsInputSchema';
import { OrganizationUncheckedCreateWithoutAttachmentsInputSchema } from './OrganizationUncheckedCreateWithoutAttachmentsInputSchema';
import { OrganizationCreateOrConnectWithoutAttachmentsInputSchema } from './OrganizationCreateOrConnectWithoutAttachmentsInputSchema';
import { OrganizationUpsertWithoutAttachmentsInputSchema } from './OrganizationUpsertWithoutAttachmentsInputSchema';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';
import { OrganizationUpdateToOneWithWhereWithoutAttachmentsInputSchema } from './OrganizationUpdateToOneWithWhereWithoutAttachmentsInputSchema';
import { OrganizationUpdateWithoutAttachmentsInputSchema } from './OrganizationUpdateWithoutAttachmentsInputSchema';
import { OrganizationUncheckedUpdateWithoutAttachmentsInputSchema } from './OrganizationUncheckedUpdateWithoutAttachmentsInputSchema';

export const OrganizationUpdateOneRequiredWithoutAttachmentsNestedInputSchema: z.ZodType<Prisma.OrganizationUpdateOneRequiredWithoutAttachmentsNestedInput> = z.object({
  create: z.union([ z.lazy(() => OrganizationCreateWithoutAttachmentsInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutAttachmentsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutAttachmentsInputSchema).optional(),
  upsert: z.lazy(() => OrganizationUpsertWithoutAttachmentsInputSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => OrganizationUpdateToOneWithWhereWithoutAttachmentsInputSchema),z.lazy(() => OrganizationUpdateWithoutAttachmentsInputSchema),z.lazy(() => OrganizationUncheckedUpdateWithoutAttachmentsInputSchema) ]).optional(),
}).strict();

export default OrganizationUpdateOneRequiredWithoutAttachmentsNestedInputSchema;
