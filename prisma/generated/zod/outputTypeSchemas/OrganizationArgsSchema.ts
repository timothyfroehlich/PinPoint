import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { OrganizationSelectSchema } from '../inputTypeSchemas/OrganizationSelectSchema';
import { OrganizationIncludeSchema } from '../inputTypeSchemas/OrganizationIncludeSchema';

export const OrganizationArgsSchema: z.ZodType<Prisma.OrganizationDefaultArgs> = z.object({
  select: z.lazy(() => OrganizationSelectSchema).optional(),
  include: z.lazy(() => OrganizationIncludeSchema).optional(),
}).strict();

export default OrganizationArgsSchema;
