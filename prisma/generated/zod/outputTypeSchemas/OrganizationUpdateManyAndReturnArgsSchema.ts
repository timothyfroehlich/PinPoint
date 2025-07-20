import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { OrganizationUpdateManyMutationInputSchema } from '../inputTypeSchemas/OrganizationUpdateManyMutationInputSchema'
import { OrganizationUncheckedUpdateManyInputSchema } from '../inputTypeSchemas/OrganizationUncheckedUpdateManyInputSchema'
import { OrganizationWhereInputSchema } from '../inputTypeSchemas/OrganizationWhereInputSchema'

export const OrganizationUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.OrganizationUpdateManyAndReturnArgs> = z.object({
  data: z.union([ OrganizationUpdateManyMutationInputSchema,OrganizationUncheckedUpdateManyInputSchema ]),
  where: OrganizationWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default OrganizationUpdateManyAndReturnArgsSchema;
