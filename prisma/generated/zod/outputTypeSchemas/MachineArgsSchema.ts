import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { MachineSelectSchema } from '../inputTypeSchemas/MachineSelectSchema';
import { MachineIncludeSchema } from '../inputTypeSchemas/MachineIncludeSchema';

export const MachineArgsSchema: z.ZodType<Prisma.MachineDefaultArgs> = z.object({
  select: z.lazy(() => MachineSelectSchema).optional(),
  include: z.lazy(() => MachineIncludeSchema).optional(),
}).strict();

export default MachineArgsSchema;
