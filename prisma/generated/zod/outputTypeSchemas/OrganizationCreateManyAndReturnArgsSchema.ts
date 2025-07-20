import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { OrganizationCreateManyInputSchema } from '../inputTypeSchemas/OrganizationCreateManyInputSchema'

export const OrganizationCreateManyAndReturnArgsSchema: z.ZodType<Prisma.OrganizationCreateManyAndReturnArgs> = z.object({
  data: z.union([ OrganizationCreateManyInputSchema,OrganizationCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export default OrganizationCreateManyAndReturnArgsSchema;
