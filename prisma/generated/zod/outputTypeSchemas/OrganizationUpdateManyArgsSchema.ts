import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { OrganizationUpdateManyMutationInputSchema } from '../inputTypeSchemas/OrganizationUpdateManyMutationInputSchema'
import { OrganizationUncheckedUpdateManyInputSchema } from '../inputTypeSchemas/OrganizationUncheckedUpdateManyInputSchema'
import { OrganizationWhereInputSchema } from '../inputTypeSchemas/OrganizationWhereInputSchema'

export const OrganizationUpdateManyArgsSchema: z.ZodType<Prisma.OrganizationUpdateManyArgs> = z.object({
  data: z.union([ OrganizationUpdateManyMutationInputSchema,OrganizationUncheckedUpdateManyInputSchema ]),
  where: OrganizationWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default OrganizationUpdateManyArgsSchema;
