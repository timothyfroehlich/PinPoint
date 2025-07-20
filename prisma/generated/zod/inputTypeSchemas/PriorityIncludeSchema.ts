import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema"
import { IssueFindManyArgsSchema } from "../outputTypeSchemas/IssueFindManyArgsSchema"
import { PriorityCountOutputTypeArgsSchema } from "../outputTypeSchemas/PriorityCountOutputTypeArgsSchema"

export const PriorityIncludeSchema: z.ZodType<Prisma.PriorityInclude> = z.object({
  organization: z.union([z.boolean(),z.lazy(() => OrganizationArgsSchema)]).optional(),
  issues: z.union([z.boolean(),z.lazy(() => IssueFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => PriorityCountOutputTypeArgsSchema)]).optional(),
}).strict()

export default PriorityIncludeSchema;
