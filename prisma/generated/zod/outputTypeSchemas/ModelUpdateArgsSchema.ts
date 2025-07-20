import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { ModelIncludeSchema } from '../inputTypeSchemas/ModelIncludeSchema'
import { ModelUpdateInputSchema } from '../inputTypeSchemas/ModelUpdateInputSchema'
import { ModelUncheckedUpdateInputSchema } from '../inputTypeSchemas/ModelUncheckedUpdateInputSchema'
import { ModelWhereUniqueInputSchema } from '../inputTypeSchemas/ModelWhereUniqueInputSchema'
import { MachineFindManyArgsSchema } from "../outputTypeSchemas/MachineFindManyArgsSchema"
import { ModelCountOutputTypeArgsSchema } from "../outputTypeSchemas/ModelCountOutputTypeArgsSchema"
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const ModelSelectSchema: z.ZodType<Prisma.ModelSelect> = z.object({
  id: z.boolean().optional(),
  name: z.boolean().optional(),
  manufacturer: z.boolean().optional(),
  year: z.boolean().optional(),
  ipdbId: z.boolean().optional(),
  opdbId: z.boolean().optional(),
  machineType: z.boolean().optional(),
  machineDisplay: z.boolean().optional(),
  isActive: z.boolean().optional(),
  ipdbLink: z.boolean().optional(),
  opdbImgUrl: z.boolean().optional(),
  kineticistUrl: z.boolean().optional(),
  isCustom: z.boolean().optional(),
  machines: z.union([z.boolean(),z.lazy(() => MachineFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => ModelCountOutputTypeArgsSchema)]).optional(),
}).strict()

export const ModelUpdateArgsSchema: z.ZodType<Prisma.ModelUpdateArgs> = z.object({
  select: ModelSelectSchema.optional(),
  include: z.lazy(() => ModelIncludeSchema).optional(),
  data: z.union([ ModelUpdateInputSchema,ModelUncheckedUpdateInputSchema ]),
  where: ModelWhereUniqueInputSchema,
}).strict() ;

export default ModelUpdateArgsSchema;
