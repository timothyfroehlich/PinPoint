import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MachineWhereUniqueInputSchema } from './MachineWhereUniqueInputSchema';
import { MachineUpdateWithoutCollectionsInputSchema } from './MachineUpdateWithoutCollectionsInputSchema';
import { MachineUncheckedUpdateWithoutCollectionsInputSchema } from './MachineUncheckedUpdateWithoutCollectionsInputSchema';

export const MachineUpdateWithWhereUniqueWithoutCollectionsInputSchema: z.ZodType<Prisma.MachineUpdateWithWhereUniqueWithoutCollectionsInput> = z.object({
  where: z.lazy(() => MachineWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => MachineUpdateWithoutCollectionsInputSchema),z.lazy(() => MachineUncheckedUpdateWithoutCollectionsInputSchema) ]),
}).strict();

export default MachineUpdateWithWhereUniqueWithoutCollectionsInputSchema;
