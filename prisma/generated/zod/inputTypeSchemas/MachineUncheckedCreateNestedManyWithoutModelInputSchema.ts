import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MachineCreateWithoutModelInputSchema } from './MachineCreateWithoutModelInputSchema';
import { MachineUncheckedCreateWithoutModelInputSchema } from './MachineUncheckedCreateWithoutModelInputSchema';
import { MachineCreateOrConnectWithoutModelInputSchema } from './MachineCreateOrConnectWithoutModelInputSchema';
import { MachineCreateManyModelInputEnvelopeSchema } from './MachineCreateManyModelInputEnvelopeSchema';
import { MachineWhereUniqueInputSchema } from './MachineWhereUniqueInputSchema';

export const MachineUncheckedCreateNestedManyWithoutModelInputSchema: z.ZodType<Prisma.MachineUncheckedCreateNestedManyWithoutModelInput> = z.object({
  create: z.union([ z.lazy(() => MachineCreateWithoutModelInputSchema),z.lazy(() => MachineCreateWithoutModelInputSchema).array(),z.lazy(() => MachineUncheckedCreateWithoutModelInputSchema),z.lazy(() => MachineUncheckedCreateWithoutModelInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => MachineCreateOrConnectWithoutModelInputSchema),z.lazy(() => MachineCreateOrConnectWithoutModelInputSchema).array() ]).optional(),
  createMany: z.lazy(() => MachineCreateManyModelInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => MachineWhereUniqueInputSchema),z.lazy(() => MachineWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default MachineUncheckedCreateNestedManyWithoutModelInputSchema;
