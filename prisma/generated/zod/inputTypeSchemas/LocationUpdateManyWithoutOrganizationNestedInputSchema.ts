import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { LocationCreateWithoutOrganizationInputSchema } from './LocationCreateWithoutOrganizationInputSchema';
import { LocationUncheckedCreateWithoutOrganizationInputSchema } from './LocationUncheckedCreateWithoutOrganizationInputSchema';
import { LocationCreateOrConnectWithoutOrganizationInputSchema } from './LocationCreateOrConnectWithoutOrganizationInputSchema';
import { LocationUpsertWithWhereUniqueWithoutOrganizationInputSchema } from './LocationUpsertWithWhereUniqueWithoutOrganizationInputSchema';
import { LocationCreateManyOrganizationInputEnvelopeSchema } from './LocationCreateManyOrganizationInputEnvelopeSchema';
import { LocationWhereUniqueInputSchema } from './LocationWhereUniqueInputSchema';
import { LocationUpdateWithWhereUniqueWithoutOrganizationInputSchema } from './LocationUpdateWithWhereUniqueWithoutOrganizationInputSchema';
import { LocationUpdateManyWithWhereWithoutOrganizationInputSchema } from './LocationUpdateManyWithWhereWithoutOrganizationInputSchema';
import { LocationScalarWhereInputSchema } from './LocationScalarWhereInputSchema';

export const LocationUpdateManyWithoutOrganizationNestedInputSchema: z.ZodType<Prisma.LocationUpdateManyWithoutOrganizationNestedInput> = z.object({
  create: z.union([ z.lazy(() => LocationCreateWithoutOrganizationInputSchema),z.lazy(() => LocationCreateWithoutOrganizationInputSchema).array(),z.lazy(() => LocationUncheckedCreateWithoutOrganizationInputSchema),z.lazy(() => LocationUncheckedCreateWithoutOrganizationInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => LocationCreateOrConnectWithoutOrganizationInputSchema),z.lazy(() => LocationCreateOrConnectWithoutOrganizationInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => LocationUpsertWithWhereUniqueWithoutOrganizationInputSchema),z.lazy(() => LocationUpsertWithWhereUniqueWithoutOrganizationInputSchema).array() ]).optional(),
  createMany: z.lazy(() => LocationCreateManyOrganizationInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => LocationWhereUniqueInputSchema),z.lazy(() => LocationWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => LocationWhereUniqueInputSchema),z.lazy(() => LocationWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => LocationWhereUniqueInputSchema),z.lazy(() => LocationWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => LocationWhereUniqueInputSchema),z.lazy(() => LocationWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => LocationUpdateWithWhereUniqueWithoutOrganizationInputSchema),z.lazy(() => LocationUpdateWithWhereUniqueWithoutOrganizationInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => LocationUpdateManyWithWhereWithoutOrganizationInputSchema),z.lazy(() => LocationUpdateManyWithWhereWithoutOrganizationInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => LocationScalarWhereInputSchema),z.lazy(() => LocationScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default LocationUpdateManyWithoutOrganizationNestedInputSchema;
