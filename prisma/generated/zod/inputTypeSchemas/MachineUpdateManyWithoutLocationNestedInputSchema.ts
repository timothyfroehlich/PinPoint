import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MachineCreateWithoutLocationInputSchema } from './MachineCreateWithoutLocationInputSchema';
import { MachineUncheckedCreateWithoutLocationInputSchema } from './MachineUncheckedCreateWithoutLocationInputSchema';
import { MachineCreateOrConnectWithoutLocationInputSchema } from './MachineCreateOrConnectWithoutLocationInputSchema';
import { MachineUpsertWithWhereUniqueWithoutLocationInputSchema } from './MachineUpsertWithWhereUniqueWithoutLocationInputSchema';
import { MachineCreateManyLocationInputEnvelopeSchema } from './MachineCreateManyLocationInputEnvelopeSchema';
import { MachineWhereUniqueInputSchema } from './MachineWhereUniqueInputSchema';
import { MachineUpdateWithWhereUniqueWithoutLocationInputSchema } from './MachineUpdateWithWhereUniqueWithoutLocationInputSchema';
import { MachineUpdateManyWithWhereWithoutLocationInputSchema } from './MachineUpdateManyWithWhereWithoutLocationInputSchema';
import { MachineScalarWhereInputSchema } from './MachineScalarWhereInputSchema';

export const MachineUpdateManyWithoutLocationNestedInputSchema: z.ZodType<Prisma.MachineUpdateManyWithoutLocationNestedInput> = z.object({
  create: z.union([ z.lazy(() => MachineCreateWithoutLocationInputSchema),z.lazy(() => MachineCreateWithoutLocationInputSchema).array(),z.lazy(() => MachineUncheckedCreateWithoutLocationInputSchema),z.lazy(() => MachineUncheckedCreateWithoutLocationInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => MachineCreateOrConnectWithoutLocationInputSchema),z.lazy(() => MachineCreateOrConnectWithoutLocationInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => MachineUpsertWithWhereUniqueWithoutLocationInputSchema),z.lazy(() => MachineUpsertWithWhereUniqueWithoutLocationInputSchema).array() ]).optional(),
  createMany: z.lazy(() => MachineCreateManyLocationInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => MachineWhereUniqueInputSchema),z.lazy(() => MachineWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => MachineWhereUniqueInputSchema),z.lazy(() => MachineWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => MachineWhereUniqueInputSchema),z.lazy(() => MachineWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => MachineWhereUniqueInputSchema),z.lazy(() => MachineWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => MachineUpdateWithWhereUniqueWithoutLocationInputSchema),z.lazy(() => MachineUpdateWithWhereUniqueWithoutLocationInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => MachineUpdateManyWithWhereWithoutLocationInputSchema),z.lazy(() => MachineUpdateManyWithWhereWithoutLocationInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => MachineScalarWhereInputSchema),z.lazy(() => MachineScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default MachineUpdateManyWithoutLocationNestedInputSchema;
