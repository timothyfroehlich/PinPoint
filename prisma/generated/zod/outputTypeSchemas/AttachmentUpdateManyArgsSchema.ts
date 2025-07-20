import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { AttachmentUpdateManyMutationInputSchema } from '../inputTypeSchemas/AttachmentUpdateManyMutationInputSchema'
import { AttachmentUncheckedUpdateManyInputSchema } from '../inputTypeSchemas/AttachmentUncheckedUpdateManyInputSchema'
import { AttachmentWhereInputSchema } from '../inputTypeSchemas/AttachmentWhereInputSchema'

export const AttachmentUpdateManyArgsSchema: z.ZodType<Prisma.AttachmentUpdateManyArgs> = z.object({
  data: z.union([ AttachmentUpdateManyMutationInputSchema,AttachmentUncheckedUpdateManyInputSchema ]),
  where: AttachmentWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default AttachmentUpdateManyArgsSchema;
