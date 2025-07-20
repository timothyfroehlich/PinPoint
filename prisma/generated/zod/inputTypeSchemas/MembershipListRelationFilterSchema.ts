import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MembershipWhereInputSchema } from './MembershipWhereInputSchema';

export const MembershipListRelationFilterSchema: z.ZodType<Prisma.MembershipListRelationFilter> = z.object({
  every: z.lazy(() => MembershipWhereInputSchema).optional(),
  some: z.lazy(() => MembershipWhereInputSchema).optional(),
  none: z.lazy(() => MembershipWhereInputSchema).optional()
}).strict();

export default MembershipListRelationFilterSchema;
