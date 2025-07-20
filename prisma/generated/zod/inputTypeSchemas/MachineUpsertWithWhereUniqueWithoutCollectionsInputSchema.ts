import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MachineWhereUniqueInputSchema } from './MachineWhereUniqueInputSchema';
import { MachineUpdateWithoutCollectionsInputSchema } from './MachineUpdateWithoutCollectionsInputSchema';
import { MachineUncheckedUpdateWithoutCollectionsInputSchema } from './MachineUncheckedUpdateWithoutCollectionsInputSchema';
import { MachineCreateWithoutCollectionsInputSchema } from './MachineCreateWithoutCollectionsInputSchema';
import { MachineUncheckedCreateWithoutCollectionsInputSchema } from './MachineUncheckedCreateWithoutCollectionsInputSchema';

export const MachineUpsertWithWhereUniqueWithoutCollectionsInputSchema: z.ZodType<Prisma.MachineUpsertWithWhereUniqueWithoutCollectionsInput> = z.object({
  where: z.lazy(() => MachineWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => MachineUpdateWithoutCollectionsInputSchema),z.lazy(() => MachineUncheckedUpdateWithoutCollectionsInputSchema) ]),
  create: z.union([ z.lazy(() => MachineCreateWithoutCollectionsInputSchema),z.lazy(() => MachineUncheckedCreateWithoutCollectionsInputSchema) ]),
}).strict();

export default MachineUpsertWithWhereUniqueWithoutCollectionsInputSchema;
