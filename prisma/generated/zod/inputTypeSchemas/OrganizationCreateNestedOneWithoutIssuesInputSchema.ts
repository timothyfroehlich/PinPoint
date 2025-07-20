import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationCreateWithoutIssuesInputSchema } from './OrganizationCreateWithoutIssuesInputSchema';
import { OrganizationUncheckedCreateWithoutIssuesInputSchema } from './OrganizationUncheckedCreateWithoutIssuesInputSchema';
import { OrganizationCreateOrConnectWithoutIssuesInputSchema } from './OrganizationCreateOrConnectWithoutIssuesInputSchema';
import { OrganizationWhereUniqueInputSchema } from './OrganizationWhereUniqueInputSchema';

export const OrganizationCreateNestedOneWithoutIssuesInputSchema: z.ZodType<Prisma.OrganizationCreateNestedOneWithoutIssuesInput> = z.object({
  create: z.union([ z.lazy(() => OrganizationCreateWithoutIssuesInputSchema),z.lazy(() => OrganizationUncheckedCreateWithoutIssuesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutIssuesInputSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional()
}).strict();

export default OrganizationCreateNestedOneWithoutIssuesInputSchema;
