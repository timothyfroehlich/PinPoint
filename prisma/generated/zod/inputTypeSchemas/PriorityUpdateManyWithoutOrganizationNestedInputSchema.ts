import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { PriorityCreateWithoutOrganizationInputSchema } from './PriorityCreateWithoutOrganizationInputSchema';
import { PriorityUncheckedCreateWithoutOrganizationInputSchema } from './PriorityUncheckedCreateWithoutOrganizationInputSchema';
import { PriorityCreateOrConnectWithoutOrganizationInputSchema } from './PriorityCreateOrConnectWithoutOrganizationInputSchema';
import { PriorityUpsertWithWhereUniqueWithoutOrganizationInputSchema } from './PriorityUpsertWithWhereUniqueWithoutOrganizationInputSchema';
import { PriorityCreateManyOrganizationInputEnvelopeSchema } from './PriorityCreateManyOrganizationInputEnvelopeSchema';
import { PriorityWhereUniqueInputSchema } from './PriorityWhereUniqueInputSchema';
import { PriorityUpdateWithWhereUniqueWithoutOrganizationInputSchema } from './PriorityUpdateWithWhereUniqueWithoutOrganizationInputSchema';
import { PriorityUpdateManyWithWhereWithoutOrganizationInputSchema } from './PriorityUpdateManyWithWhereWithoutOrganizationInputSchema';
import { PriorityScalarWhereInputSchema } from './PriorityScalarWhereInputSchema';

export const PriorityUpdateManyWithoutOrganizationNestedInputSchema: z.ZodType<Prisma.PriorityUpdateManyWithoutOrganizationNestedInput> = z.object({
  create: z.union([ z.lazy(() => PriorityCreateWithoutOrganizationInputSchema),z.lazy(() => PriorityCreateWithoutOrganizationInputSchema).array(),z.lazy(() => PriorityUncheckedCreateWithoutOrganizationInputSchema),z.lazy(() => PriorityUncheckedCreateWithoutOrganizationInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => PriorityCreateOrConnectWithoutOrganizationInputSchema),z.lazy(() => PriorityCreateOrConnectWithoutOrganizationInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => PriorityUpsertWithWhereUniqueWithoutOrganizationInputSchema),z.lazy(() => PriorityUpsertWithWhereUniqueWithoutOrganizationInputSchema).array() ]).optional(),
  createMany: z.lazy(() => PriorityCreateManyOrganizationInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => PriorityWhereUniqueInputSchema),z.lazy(() => PriorityWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => PriorityWhereUniqueInputSchema),z.lazy(() => PriorityWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => PriorityWhereUniqueInputSchema),z.lazy(() => PriorityWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => PriorityWhereUniqueInputSchema),z.lazy(() => PriorityWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => PriorityUpdateWithWhereUniqueWithoutOrganizationInputSchema),z.lazy(() => PriorityUpdateWithWhereUniqueWithoutOrganizationInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => PriorityUpdateManyWithWhereWithoutOrganizationInputSchema),z.lazy(() => PriorityUpdateManyWithWhereWithoutOrganizationInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => PriorityScalarWhereInputSchema),z.lazy(() => PriorityScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default PriorityUpdateManyWithoutOrganizationNestedInputSchema;
