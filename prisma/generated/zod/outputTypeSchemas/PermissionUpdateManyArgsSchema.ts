import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { PermissionUpdateManyMutationInputSchema } from '../inputTypeSchemas/PermissionUpdateManyMutationInputSchema'
import { PermissionUncheckedUpdateManyInputSchema } from '../inputTypeSchemas/PermissionUncheckedUpdateManyInputSchema'
import { PermissionWhereInputSchema } from '../inputTypeSchemas/PermissionWhereInputSchema'

export const PermissionUpdateManyArgsSchema: z.ZodType<Prisma.PermissionUpdateManyArgs> = z.object({
  data: z.union([ PermissionUpdateManyMutationInputSchema,PermissionUncheckedUpdateManyInputSchema ]),
  where: PermissionWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default PermissionUpdateManyArgsSchema;
