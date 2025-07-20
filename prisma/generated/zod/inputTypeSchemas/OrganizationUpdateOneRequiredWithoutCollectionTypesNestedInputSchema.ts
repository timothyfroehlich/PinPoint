import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationCreateWithoutCollectionTypesInputSchema } from './OrganizationCreateWithoutCollectionTypesInputSchema';
import { OrganizationUncheckedCreateWithoutCollectionTypesInputSchema } from './OrganizationUncheckedCreateWithoutCollectionTypesInputSchema';
import { OrganizationCreateOrConnectWithoutCollectionTypesInputSchema } from './OrganizationCreateOrConnectWithoutCollectionTypesInputSchema';
import { OrganizationUpsertWithoutCollectionTypesInputSchema } from './OrganizationUpsertWithoutCollectionTypesInputSchema';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';
import { OrganizationUpdateToOneWithWhereWithoutCollectionTypesInputSchema } from './OrganizationUpdateToOneWithWhereWithoutCollectionTypesInputSchema';
import { OrganizationUpdateWithoutCollectionTypesInputSchema } from './OrganizationUpdateWithoutCollectionTypesInputSchema';
import { OrganizationUncheckedUpdateWithoutCollectionTypesInputSchema } from './OrganizationUncheckedUpdateWithoutCollectionTypesInputSchema';

export const OrganizationUpdateOneRequiredWithoutCollectionTypesNestedInputSchema: z.ZodType<Prisma.OrganizationUpdateOneRequiredWithoutCollectionTypesNestedInput> = z.object({
  create: z.union([ z.lazy(() => OrganizationCreateWithoutCollectionTypesInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutCollectionTypesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutCollectionTypesInputSchema).optional(),
  upsert: z.lazy(() => OrganizationUpsertWithoutCollectionTypesInputSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => OrganizationUpdateToOneWithWhereWithoutCollectionTypesInputSchema),z.lazy(() => OrganizationUpdateWithoutCollectionTypesInputSchema),z.lazy(() => OrganizationUncheckedUpdateWithoutCollectionTypesInputSchema) ]).optional(),
}).strict();

export default OrganizationUpdateOneRequiredWithoutCollectionTypesNestedInputSchema;
