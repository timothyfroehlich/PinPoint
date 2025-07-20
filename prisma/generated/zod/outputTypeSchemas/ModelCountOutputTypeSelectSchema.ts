import { z } from 'zod';
import type { Prisma } from '@prisma/client';

export const ModelCountOutputTypeSelectSchema: z.ZodType<Prisma.ModelCountOutputTypeSelect> = z.object({
  machines: z.boolean().optional(),
}).strict();

export default ModelCountOutputTypeSelectSchema;
