import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { MachineFindManyArgsSchema } from "../outputTypeSchemas/MachineFindManyArgsSchema"
import { ModelCountOutputTypeArgsSchema } from "../outputTypeSchemas/ModelCountOutputTypeArgsSchema"

export const ModelIncludeSchema: z.ZodType<Prisma.ModelInclude> = z.object({
  machines: z.union([z.boolean(),z.lazy(() => MachineFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => ModelCountOutputTypeArgsSchema)]).optional(),
}).strict()

export default ModelIncludeSchema;
