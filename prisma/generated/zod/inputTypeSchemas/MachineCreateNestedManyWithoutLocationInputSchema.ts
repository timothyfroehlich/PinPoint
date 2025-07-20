import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MachineCreateWithoutLocationInputSchema } from './MachineCreateWithoutLocationInputSchema';
import { MachineUncheckedCreateWithoutLocationInputSchema } from './MachineUncheckedCreateWithoutLocationInputSchema';
import { MachineCreateOrConnectWithoutLocationInputSchema } from './MachineCreateOrConnectWithoutLocationInputSchema';
import { MachineCreateManyLocationInputEnvelopeSchema } from './MachineCreateManyLocationInputEnvelopeSchema';
import { MachineWhereUniqueInputSchema } from './MachineWhereUniqueInputSchema';

export const MachineCreateNestedManyWithoutLocationInputSchema: z.ZodType<Prisma.MachineCreateNestedManyWithoutLocationInput> = z.object({
  create: z.union([ z.lazy(() => MachineCreateWithoutLocationInputSchema),z.lazy(() => MachineCreateWithoutLocationInputSchema).array(),z.lazy(() => MachineUncheckedCreateWithoutLocationInputSchema),z.lazy(() => MachineUncheckedCreateWithoutLocationInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => MachineCreateOrConnectWithoutLocationInputSchema),z.lazy(() => MachineCreateOrConnectWithoutLocationInputSchema).array() ]).optional(),
  createMany: z.lazy(() => MachineCreateManyLocationInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => MachineWhereUniqueInputSchema),z.lazy(() => MachineWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default MachineCreateNestedManyWithoutLocationInputSchema;
