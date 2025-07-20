import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MachineCreateWithoutOrganizationInputSchema } from './MachineCreateWithoutOrganizationInputSchema';
import { MachineUncheckedCreateWithoutOrganizationInputSchema } from './MachineUncheckedCreateWithoutOrganizationInputSchema';
import { MachineCreateOrConnectWithoutOrganizationInputSchema } from './MachineCreateOrConnectWithoutOrganizationInputSchema';
import { MachineCreateManyOrganizationInputEnvelopeSchema } from './MachineCreateManyOrganizationInputEnvelopeSchema';
import { MachineWhereUniqueInputSchema } from './MachineWhereUniqueInputSchema';

export const MachineUncheckedCreateNestedManyWithoutOrganizationInputSchema: z.ZodType<Prisma.MachineUncheckedCreateNestedManyWithoutOrganizationInput> = z.object({
  create: z.union([ z.lazy(() => MachineCreateWithoutOrganizationInputSchema),z.lazy(() => MachineCreateWithoutOrganizationInputSchema).array(),z.lazy(() => MachineUncheckedCreateWithoutOrganizationInputSchema),z.lazy(() => MachineUncheckedCreateWithoutOrganizationInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => MachineCreateOrConnectWithoutOrganizationInputSchema),z.lazy(() => MachineCreateOrConnectWithoutOrganizationInputSchema).array() ]).optional(),
  createMany: z.lazy(() => MachineCreateManyOrganizationInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => MachineWhereUniqueInputSchema),z.lazy(() => MachineWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default MachineUncheckedCreateNestedManyWithoutOrganizationInputSchema;
