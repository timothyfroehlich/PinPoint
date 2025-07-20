import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationCreateWithoutPinballMapConfigInputSchema } from './OrganizationCreateWithoutPinballMapConfigInputSchema';
import { OrganizationUncheckedCreateWithoutPinballMapConfigInputSchema } from './OrganizationUncheckedCreateWithoutPinballMapConfigInputSchema';
import { OrganizationCreateOrConnectWithoutPinballMapConfigInputSchema } from './OrganizationCreateOrConnectWithoutPinballMapConfigInputSchema';
import { OrganizationUpsertWithoutPinballMapConfigInputSchema } from './OrganizationUpsertWithoutPinballMapConfigInputSchema';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';
import { OrganizationUpdateToOneWithWhereWithoutPinballMapConfigInputSchema } from './OrganizationUpdateToOneWithWhereWithoutPinballMapConfigInputSchema';
import { OrganizationUpdateWithoutPinballMapConfigInputSchema } from './OrganizationUpdateWithoutPinballMapConfigInputSchema';
import { OrganizationUncheckedUpdateWithoutPinballMapConfigInputSchema } from './OrganizationUncheckedUpdateWithoutPinballMapConfigInputSchema';

export const OrganizationUpdateOneRequiredWithoutPinballMapConfigNestedInputSchema: z.ZodType<Prisma.OrganizationUpdateOneRequiredWithoutPinballMapConfigNestedInput> = z.object({
  create: z.union([ z.lazy(() => OrganizationCreateWithoutPinballMapConfigInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutPinballMapConfigInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutPinballMapConfigInputSchema).optional(),
  upsert: z.lazy(() => OrganizationUpsertWithoutPinballMapConfigInputSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => OrganizationUpdateToOneWithWhereWithoutPinballMapConfigInputSchema),z.lazy(() => OrganizationUpdateWithoutPinballMapConfigInputSchema),z.lazy(() => OrganizationUncheckedUpdateWithoutPinballMapConfigInputSchema) ]).optional(),
}).strict();

export default OrganizationUpdateOneRequiredWithoutPinballMapConfigNestedInputSchema;
