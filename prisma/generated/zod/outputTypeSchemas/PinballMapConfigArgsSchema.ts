import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { PinballMapConfigSelectSchema } from '../inputTypeSchemas/PinballMapConfigSelectSchema';
import { PinballMapConfigIncludeSchema } from '../inputTypeSchemas/PinballMapConfigIncludeSchema';

export const PinballMapConfigArgsSchema: z.ZodType<Prisma.PinballMapConfigDefaultArgs> = z.object({
  select: z.lazy(() => PinballMapConfigSelectSchema).optional(),
  include: z.lazy(() => PinballMapConfigIncludeSchema).optional(),
}).strict();

export default PinballMapConfigArgsSchema;
