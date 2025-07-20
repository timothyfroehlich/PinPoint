import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const RoleNameOrganizationIdCompoundUniqueInputSchema: z.ZodType<Prisma.RoleNameOrganizationIdCompoundUniqueInput> = z.object({
  name: z.string(),
  organizationId: z.string()
}).strict();

export default RoleNameOrganizationIdCompoundUniqueInputSchema;
