import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { PrioritySelectSchema } from '../inputTypeSchemas/PrioritySelectSchema';
import { PriorityIncludeSchema } from '../inputTypeSchemas/PriorityIncludeSchema';

export const PriorityArgsSchema: z.ZodType<Prisma.PriorityDefaultArgs> = z.object({
  select: z.lazy(() => PrioritySelectSchema).optional(),
  include: z.lazy(() => PriorityIncludeSchema).optional(),
}).strict();

export default PriorityArgsSchema;
