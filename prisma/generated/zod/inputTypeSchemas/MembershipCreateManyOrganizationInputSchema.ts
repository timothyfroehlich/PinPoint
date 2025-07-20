import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const MembershipCreateManyOrganizationInputSchema: z.ZodType<Prisma.MembershipCreateManyOrganizationInput> = z.object({
  id: z.string().cuid().optional(),
  userId: z.string(),
  roleId: z.string()
}).strict();

export default MembershipCreateManyOrganizationInputSchema;
