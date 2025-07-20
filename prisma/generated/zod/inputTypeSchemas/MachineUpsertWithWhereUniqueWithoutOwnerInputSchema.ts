import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MachineWhereUniqueInputSchema } from './MachineWhereUniqueInputSchema';
import { MachineUpdateWithoutOwnerInputSchema } from './MachineUpdateWithoutOwnerInputSchema';
import { MachineUncheckedUpdateWithoutOwnerInputSchema } from './MachineUncheckedUpdateWithoutOwnerInputSchema';
import { MachineCreateWithoutOwnerInputSchema } from './MachineCreateWithoutOwnerInputSchema';
import { MachineUncheckedCreateWithoutOwnerInputSchema } from './MachineUncheckedCreateWithoutOwnerInputSchema';

export const MachineUpsertWithWhereUniqueWithoutOwnerInputSchema: z.ZodType<Prisma.MachineUpsertWithWhereUniqueWithoutOwnerInput> = z.object({
  where: z.lazy(() => MachineWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => MachineUpdateWithoutOwnerInputSchema),z.lazy(() => MachineUncheckedUpdateWithoutOwnerInputSchema) ]),
  create: z.union([ z.lazy(() => MachineCreateWithoutOwnerInputSchema),z.lazy(() => MachineUncheckedCreateWithoutOwnerInputSchema) ]),
}).strict();

export default MachineUpsertWithWhereUniqueWithoutOwnerInputSchema;
