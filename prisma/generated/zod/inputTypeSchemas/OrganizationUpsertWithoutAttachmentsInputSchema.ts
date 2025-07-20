import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationUpdateWithoutAttachmentsInputSchema } from './OrganizationUpdateWithoutAttachmentsInputSchema';
import { OrganizationUncheckedUpdateWithoutAttachmentsInputSchema } from './OrganizationUncheckedUpdateWithoutAttachmentsInputSchema';
import { OrganizationCreateWithoutAttachmentsInputSchema } from './OrganizationCreateWithoutAttachmentsInputSchema';
import { OrganizationUncheckedCreateWithoutAttachmentsInputSchema } from './OrganizationUncheckedCreateWithoutAttachmentsInputSchema';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';

export const OrganizationUpsertWithoutAttachmentsInputSchema: z.ZodType<Prisma.OrganizationUpsertWithoutAttachmentsInput> = z.object({
  update: z.union([ z.lazy(() => OrganizationUpdateWithoutAttachmentsInputSchema),z.lazy(() => OrganizationUncheckedUpdateWithoutAttachmentsInputSchema) ]),
  create: z.union([ z.lazy(() => OrganizationCreateWithoutAttachmentsInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutAttachmentsInputSchema) ]),
  where: z.lazy(() => OrganizationWhereInputSchema).optional()
}).strict();

export default OrganizationUpsertWithoutAttachmentsInputSchema;
