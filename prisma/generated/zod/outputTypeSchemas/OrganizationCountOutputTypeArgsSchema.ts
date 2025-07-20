import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { OrganizationCountOutputTypeSelectSchema } from './OrganizationCountOutputTypeSelectSchema';

export const OrganizationCountOutputTypeArgsSchema: z.ZodType<Prisma.OrganizationCountOutputTypeDefaultArgs> = z.object({
  select: z.lazy(() => OrganizationCountOutputTypeSelectSchema).nullish(),
}).strict();

export default OrganizationCountOutputTypeSelectSchema;
