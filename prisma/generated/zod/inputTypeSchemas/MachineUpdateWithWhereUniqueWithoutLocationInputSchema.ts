import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MachineWhereUniqueInputSchema } from './MachineWhereUniqueInputSchema';
import { MachineUpdateWithoutLocationInputSchema } from './MachineUpdateWithoutLocationInputSchema';
import { MachineUncheckedUpdateWithoutLocationInputSchema } from './MachineUncheckedUpdateWithoutLocationInputSchema';

export const MachineUpdateWithWhereUniqueWithoutLocationInputSchema: z.ZodType<Prisma.MachineUpdateWithWhereUniqueWithoutLocationInput> = z.object({
  where: z.lazy(() => MachineWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => MachineUpdateWithoutLocationInputSchema),z.lazy(() => MachineUncheckedUpdateWithoutLocationInputSchema) ]),
}).strict();

export default MachineUpdateWithWhereUniqueWithoutLocationInputSchema;
