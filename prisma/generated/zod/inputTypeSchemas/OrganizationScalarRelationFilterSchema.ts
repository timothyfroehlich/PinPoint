import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';

export const OrganizationScalarRelationFilterSchema: z.ZodType<Prisma.OrganizationScalarRelationFilter> = z.object({
  is: z.lazy(() => OrganizationWhereInputSchema).optional(),
  isNot: z.lazy(() => OrganizationWhereInputSchema).optional()
}).strict();

export default OrganizationScalarRelationFilterSchema;
