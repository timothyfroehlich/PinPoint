import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { CollectionCreateManyInputSchema } from '../inputTypeSchemas/CollectionCreateManyInputSchema'

export const CollectionCreateManyArgsSchema: z.ZodType<Prisma.CollectionCreateManyArgs> = z.object({
  data: z.union([ CollectionCreateManyInputSchema,CollectionCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export default CollectionCreateManyArgsSchema;
