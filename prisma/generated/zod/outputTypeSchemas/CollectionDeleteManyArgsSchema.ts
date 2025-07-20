import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { CollectionWhereInputSchema } from '../inputTypeSchemas/CollectionWhereInputSchema'

export const CollectionDeleteManyArgsSchema: z.ZodType<Prisma.CollectionDeleteManyArgs> = z.object({
  where: CollectionWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default CollectionDeleteManyArgsSchema;
