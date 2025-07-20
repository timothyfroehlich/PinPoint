import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MachineWhereUniqueInputSchema } from './MachineWhereUniqueInputSchema';
import { MachineUpdateWithoutOwnerInputSchema } from './MachineUpdateWithoutOwnerInputSchema';
import { MachineUncheckedUpdateWithoutOwnerInputSchema } from './MachineUncheckedUpdateWithoutOwnerInputSchema';

export const MachineUpdateWithWhereUniqueWithoutOwnerInputSchema: z.ZodType<Prisma.MachineUpdateWithWhereUniqueWithoutOwnerInput> = z.object({
  where: z.lazy(() => MachineWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => MachineUpdateWithoutOwnerInputSchema),z.lazy(() => MachineUncheckedUpdateWithoutOwnerInputSchema) ]),
}).strict();

export default MachineUpdateWithWhereUniqueWithoutOwnerInputSchema;
