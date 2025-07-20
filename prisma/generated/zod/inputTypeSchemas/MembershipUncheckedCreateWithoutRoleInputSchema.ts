import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const MembershipUncheckedCreateWithoutRoleInputSchema: z.ZodType<Prisma.MembershipUncheckedCreateWithoutRoleInput> = z.object({
  id: z.string().cuid().optional(),
  userId: z.string(),
  organizationId: z.string()
}).strict();

export default MembershipUncheckedCreateWithoutRoleInputSchema;
