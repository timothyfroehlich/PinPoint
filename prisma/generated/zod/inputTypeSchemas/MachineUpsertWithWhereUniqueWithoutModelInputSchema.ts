import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MachineWhereUniqueInputSchema } from './MachineWhereUniqueInputSchema';
import { MachineUpdateWithoutModelInputSchema } from './MachineUpdateWithoutModelInputSchema';
import { MachineUncheckedUpdateWithoutModelInputSchema } from './MachineUncheckedUpdateWithoutModelInputSchema';
import { MachineCreateWithoutModelInputSchema } from './MachineCreateWithoutModelInputSchema';
import { MachineUncheckedCreateWithoutModelInputSchema } from './MachineUncheckedCreateWithoutModelInputSchema';

export const MachineUpsertWithWhereUniqueWithoutModelInputSchema: z.ZodType<Prisma.MachineUpsertWithWhereUniqueWithoutModelInput> = z.object({
  where: z.lazy(() => MachineWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => MachineUpdateWithoutModelInputSchema),z.lazy(() => MachineUncheckedUpdateWithoutModelInputSchema) ]),
  create: z.union([ z.lazy(() => MachineCreateWithoutModelInputSchema),z.lazy(() => MachineUncheckedCreateWithoutModelInputSchema) ]),
}).strict();

export default MachineUpsertWithWhereUniqueWithoutModelInputSchema;
