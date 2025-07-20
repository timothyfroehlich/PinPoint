import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { MachineCountOutputTypeSelectSchema } from './MachineCountOutputTypeSelectSchema';

export const MachineCountOutputTypeArgsSchema: z.ZodType<Prisma.MachineCountOutputTypeDefaultArgs> = z.object({
  select: z.lazy(() => MachineCountOutputTypeSelectSchema).nullish(),
}).strict();

export default MachineCountOutputTypeSelectSchema;
