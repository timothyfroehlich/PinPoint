import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { CollectionTypeSelectSchema } from '../inputTypeSchemas/CollectionTypeSelectSchema';
import { CollectionTypeIncludeSchema } from '../inputTypeSchemas/CollectionTypeIncludeSchema';

export const CollectionTypeArgsSchema: z.ZodType<Prisma.CollectionTypeDefaultArgs> = z.object({
  select: z.lazy(() => CollectionTypeSelectSchema).optional(),
  include: z.lazy(() => CollectionTypeIncludeSchema).optional(),
}).strict();

export default CollectionTypeArgsSchema;
