import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { CollectionCreateManyInputSchema } from '../inputTypeSchemas/CollectionCreateManyInputSchema'

export const CollectionCreateManyAndReturnArgsSchema: z.ZodType<Prisma.CollectionCreateManyAndReturnArgs> = z.object({
  data: z.union([ CollectionCreateManyInputSchema,CollectionCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export default CollectionCreateManyAndReturnArgsSchema;
