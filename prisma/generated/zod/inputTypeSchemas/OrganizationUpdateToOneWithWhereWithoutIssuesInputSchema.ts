import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';
import { OrganizationUpdateWithoutIssuesInputSchema } from './OrganizationUpdateWithoutIssuesInputSchema';
import { OrganizationUncheckedUpdateWithoutIssuesInputSchema } from './OrganizationUncheckedUpdateWithoutIssuesInputSchema';

export const OrganizationUpdateToOneWithWhereWithoutIssuesInputSchema: z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutIssuesInput> = z.object({
  where: z.lazy(() => OrganizationWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => OrganizationUpdateWithoutIssuesInputSchema),z.lazy(() => OrganizationUncheckedUpdateWithoutIssuesInputSchema) ]),
}).strict();

export default OrganizationUpdateToOneWithWhereWithoutIssuesInputSchema;
