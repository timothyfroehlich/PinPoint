import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { OrganizationWhereInputSchema } from '../inputTypeSchemas/OrganizationWhereInputSchema'

export const OrganizationDeleteManyArgsSchema: z.ZodType<Prisma.OrganizationDeleteManyArgs> = z.object({
  where: OrganizationWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export default OrganizationDeleteManyArgsSchema;
