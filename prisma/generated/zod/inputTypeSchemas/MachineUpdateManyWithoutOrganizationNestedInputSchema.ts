import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MachineCreateWithoutOrganizationInputSchema } from './MachineCreateWithoutOrganizationInputSchema';
import { MachineUncheckedCreateWithoutOrganizationInputSchema } from './MachineUncheckedCreateWithoutOrganizationInputSchema';
import { MachineCreateOrConnectWithoutOrganizationInputSchema } from './MachineCreateOrConnectWithoutOrganizationInputSchema';
import { MachineUpsertWithWhereUniqueWithoutOrganizationInputSchema } from './MachineUpsertWithWhereUniqueWithoutOrganizationInputSchema';
import { MachineCreateManyOrganizationInputEnvelopeSchema } from './MachineCreateManyOrganizationInputEnvelopeSchema';
import { MachineWhereUniqueInputSchema } from './MachineWhereUniqueInputSchema';
import { MachineUpdateWithWhereUniqueWithoutOrganizationInputSchema } from './MachineUpdateWithWhereUniqueWithoutOrganizationInputSchema';
import { MachineUpdateManyWithWhereWithoutOrganizationInputSchema } from './MachineUpdateManyWithWhereWithoutOrganizationInputSchema';
import { MachineScalarWhereInputSchema } from './MachineScalarWhereInputSchema';

export const MachineUpdateManyWithoutOrganizationNestedInputSchema: z.ZodType<Prisma.MachineUpdateManyWithoutOrganizationNestedInput> = z.object({
  create: z.union([ z.lazy(() => MachineCreateWithoutOrganizationInputSchema),z.lazy(() => MachineCreateWithoutOrganizationInputSchema).array(),z.lazy(() => MachineUncheckedCreateWithoutOrganizationInputSchema),z.lazy(() => MachineUncheckedCreateWithoutOrganizationInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => MachineCreateOrConnectWithoutOrganizationInputSchema),z.lazy(() => MachineCreateOrConnectWithoutOrganizationInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => MachineUpsertWithWhereUniqueWithoutOrganizationInputSchema),z.lazy(() => MachineUpsertWithWhereUniqueWithoutOrganizationInputSchema).array() ]).optional(),
  createMany: z.lazy(() => MachineCreateManyOrganizationInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => MachineWhereUniqueInputSchema),z.lazy(() => MachineWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => MachineWhereUniqueInputSchema),z.lazy(() => MachineWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => MachineWhereUniqueInputSchema),z.lazy(() => MachineWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => MachineWhereUniqueInputSchema),z.lazy(() => MachineWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => MachineUpdateWithWhereUniqueWithoutOrganizationInputSchema),z.lazy(() => MachineUpdateWithWhereUniqueWithoutOrganizationInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => MachineUpdateManyWithWhereWithoutOrganizationInputSchema),z.lazy(() => MachineUpdateManyWithWhereWithoutOrganizationInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => MachineScalarWhereInputSchema),z.lazy(() => MachineScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default MachineUpdateManyWithoutOrganizationNestedInputSchema;
