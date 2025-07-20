import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const MembershipUserIdOrganizationIdCompoundUniqueInputSchema: z.ZodType<Prisma.MembershipUserIdOrganizationIdCompoundUniqueInput> = z.object({
  userId: z.string(),
  organizationId: z.string()
}).strict();

export default MembershipUserIdOrganizationIdCompoundUniqueInputSchema;
