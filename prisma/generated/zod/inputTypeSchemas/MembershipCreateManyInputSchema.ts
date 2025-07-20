import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const MembershipCreateManyInputSchema: z.ZodType<Prisma.MembershipCreateManyInput> = z.object({
  id: z.string().cuid().optional(),
  userId: z.string(),
  organizationId: z.string(),
  roleId: z.string()
}).strict();

export default MembershipCreateManyInputSchema;
