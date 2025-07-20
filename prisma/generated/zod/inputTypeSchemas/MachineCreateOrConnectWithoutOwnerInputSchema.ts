import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MachineWhereUniqueInputSchema } from './MachineWhereUniqueInputSchema';
import { MachineCreateWithoutOwnerInputSchema } from './MachineCreateWithoutOwnerInputSchema';
import { MachineUncheckedCreateWithoutOwnerInputSchema } from './MachineUncheckedCreateWithoutOwnerInputSchema';

export const MachineCreateOrConnectWithoutOwnerInputSchema: z.ZodType<Prisma.MachineCreateOrConnectWithoutOwnerInput> = z.object({
  where: z.lazy(() => MachineWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => MachineCreateWithoutOwnerInputSchema),z.lazy(() => MachineUncheckedCreateWithoutOwnerInputSchema) ]),
}).strict();

export default MachineCreateOrConnectWithoutOwnerInputSchema;
