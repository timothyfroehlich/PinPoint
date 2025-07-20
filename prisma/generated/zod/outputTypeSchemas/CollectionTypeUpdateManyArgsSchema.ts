import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { CollectionTypeUpdateManyMutationInputSchema } from '../inputTypeSchemas/CollectionTypeUpdateManyMutationInputSchema'
import { CollectionTypeUncheckedUpdateManyInputSchema } from '../inputTypeSchemas/CollectionTypeUncheckedUpdateManyInputSchema'
import { CollectionTypeWhereInputSchema } from '../inputTypeSchemas/CollectionTypeWhereInputSchema'

export const CollectionTypeUpdateManyArgsSchema: z.ZodType<Prisma.CollectionTypeUpdateManyArgs> = z.object({
  data: z.union([ CollectionTypeUpdateManyMutationInputSchema,CollectionTypeUncheckedUpdateManyInputSchema ]),
  where: CollectionTypeWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default CollectionTypeUpdateManyArgsSchema;
