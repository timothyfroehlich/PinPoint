import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MachineWhereUniqueInputSchema } from './MachineWhereUniqueInputSchema';
import { MachineUpdateWithoutLocationInputSchema } from './MachineUpdateWithoutLocationInputSchema';
import { MachineUncheckedUpdateWithoutLocationInputSchema } from './MachineUncheckedUpdateWithoutLocationInputSchema';
import { MachineCreateWithoutLocationInputSchema } from './MachineCreateWithoutLocationInputSchema';
import { MachineUncheckedCreateWithoutLocationInputSchema } from './MachineUncheckedCreateWithoutLocationInputSchema';

export const MachineUpsertWithWhereUniqueWithoutLocationInputSchema: z.ZodType<Prisma.MachineUpsertWithWhereUniqueWithoutLocationInput> = z.object({
  where: z.lazy(() => MachineWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => MachineUpdateWithoutLocationInputSchema),z.lazy(() => MachineUncheckedUpdateWithoutLocationInputSchema) ]),
  create: z.union([ z.lazy(() => MachineCreateWithoutLocationInputSchema),z.lazy(() => MachineUncheckedCreateWithoutLocationInputSchema) ]),
}).strict();

export default MachineUpsertWithWhereUniqueWithoutLocationInputSchema;
