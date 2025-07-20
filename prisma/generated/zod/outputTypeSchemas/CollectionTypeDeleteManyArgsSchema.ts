import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { CollectionTypeWhereInputSchema } from '../inputTypeSchemas/CollectionTypeWhereInputSchema'

export const CollectionTypeDeleteManyArgsSchema: z.ZodType<Prisma.CollectionTypeDeleteManyArgs> = z.object({
  where: CollectionTypeWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default CollectionTypeDeleteManyArgsSchema;
