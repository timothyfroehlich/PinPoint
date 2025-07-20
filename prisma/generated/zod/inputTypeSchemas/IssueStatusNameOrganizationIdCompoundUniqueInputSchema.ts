import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const IssueStatusNameOrganizationIdCompoundUniqueInputSchema: z.ZodType<Prisma.IssueStatusNameOrganizationIdCompoundUniqueInput> = z.object({
  name: z.string(),
  organizationId: z.string()
}).strict();

export default IssueStatusNameOrganizationIdCompoundUniqueInputSchema;
