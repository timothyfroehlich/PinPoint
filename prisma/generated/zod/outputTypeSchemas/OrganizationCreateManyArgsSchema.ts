import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { OrganizationCreateManyInputSchema } from '../inputTypeSchemas/OrganizationCreateManyInputSchema'

export const OrganizationCreateManyArgsSchema: z.ZodType<Prisma.OrganizationCreateManyArgs> = z.object({
  data: z.union([ OrganizationCreateManyInputSchema,OrganizationCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export default OrganizationCreateManyArgsSchema;
