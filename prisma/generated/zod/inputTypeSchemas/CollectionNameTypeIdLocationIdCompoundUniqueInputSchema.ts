import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const CollectionNameTypeIdLocationIdCompoundUniqueInputSchema: z.ZodType<Prisma.CollectionNameTypeIdLocationIdCompoundUniqueInput> = z.object({
  name: z.string(),
  typeId: z.string(),
  locationId: z.string()
}).strict();

export default CollectionNameTypeIdLocationIdCompoundUniqueInputSchema;
