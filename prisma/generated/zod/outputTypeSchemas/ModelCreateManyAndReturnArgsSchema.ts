import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { ModelCreateManyInputSchema } from '../inputTypeSchemas/ModelCreateManyInputSchema'

export const ModelCreateManyAndReturnArgsSchema: z.ZodType<Prisma.ModelCreateManyAndReturnArgs> = z.object({
  data: z.union([ ModelCreateManyInputSchema,ModelCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export default ModelCreateManyAndReturnArgsSchema;
