import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { UpvoteUpdateManyMutationInputSchema } from '../inputTypeSchemas/UpvoteUpdateManyMutationInputSchema'
import { UpvoteUncheckedUpdateManyInputSchema } from '../inputTypeSchemas/UpvoteUncheckedUpdateManyInputSchema'
import { UpvoteWhereInputSchema } from '../inputTypeSchemas/UpvoteWhereInputSchema'

export const UpvoteUpdateManyArgsSchema: z.ZodType<Prisma.UpvoteUpdateManyArgs> = z.object({
  data: z.union([ UpvoteUpdateManyMutationInputSchema,UpvoteUncheckedUpdateManyInputSchema ]),
  where: UpvoteWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default UpvoteUpdateManyArgsSchema;
