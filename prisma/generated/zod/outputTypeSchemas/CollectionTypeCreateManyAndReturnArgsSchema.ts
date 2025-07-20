import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { CollectionTypeCreateManyInputSchema } from '../inputTypeSchemas/CollectionTypeCreateManyInputSchema'

export const CollectionTypeCreateManyAndReturnArgsSchema: z.ZodType<Prisma.CollectionTypeCreateManyAndReturnArgs> = z.object({
  data: z.union([ CollectionTypeCreateManyInputSchema,CollectionTypeCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export default CollectionTypeCreateManyAndReturnArgsSchema;
