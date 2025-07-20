import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const CollectionTypeNameOrganizationIdCompoundUniqueInputSchema: z.ZodType<Prisma.CollectionTypeNameOrganizationIdCompoundUniqueInput> = z.object({
  name: z.string(),
  organizationId: z.string()
}).strict();

export default CollectionTypeNameOrganizationIdCompoundUniqueInputSchema;
