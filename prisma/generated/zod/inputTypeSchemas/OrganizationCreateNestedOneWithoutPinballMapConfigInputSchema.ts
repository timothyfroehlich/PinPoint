import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationCreateWithoutPinballMapConfigInputSchema } from './OrganizationCreateWithoutPinballMapConfigInputSchema';
import { OrganizationUncheckedCreateWithoutPinballMapConfigInputSchema } from './OrganizationUncheckedCreateWithoutPinballMapConfigInputSchema';
import { OrganizationCreateOrConnectWithoutPinballMapConfigInputSchema } from './OrganizationCreateOrConnectWithoutPinballMapConfigInputSchema';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';

export const OrganizationCreateNestedOneWithoutPinballMapConfigInputSchema: z.ZodType<Prisma.OrganizationCreateNestedOneWithoutPinballMapConfigInput> = z.object({
  create: z.union([ z.lazy(() => OrganizationCreateWithoutPinballMapConfigInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutPinballMapConfigInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutPinballMapConfigInputSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional()
}).strict();

export default OrganizationCreateNestedOneWithoutPinballMapConfigInputSchema;
