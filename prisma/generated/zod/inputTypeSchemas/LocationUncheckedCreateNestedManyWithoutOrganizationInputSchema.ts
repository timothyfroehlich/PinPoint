import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { LocationCreateWithoutOrganizationInputSchema } from './LocationCreateWithoutOrganizationInputSchema';
import { LocationUncheckedCreateWithoutOrganizationInputSchema } from './LocationUncheckedCreateWithoutOrganizationInputSchema';
import { LocationCreateOrConnectWithoutOrganizationInputSchema } from './LocationCreateOrConnectWithoutOrganizationInputSchema';
import { LocationCreateManyOrganizationInputEnvelopeSchema } from './LocationCreateManyOrganizationInputEnvelopeSchema';
import { LocationWhereUniqueInputSchema } from './LocationWhereUniqueInputSchema';

export const LocationUncheckedCreateNestedManyWithoutOrganizationInputSchema: z.ZodType<Prisma.LocationUncheckedCreateNestedManyWithoutOrganizationInput> = z.object({
  create: z.union([ z.lazy(() => LocationCreateWithoutOrganizationInputSchema),z.lazy(() => LocationCreateWithoutOrganizationInputSchema).array(),z.lazy(() => LocationUncheckedCreateWithoutOrganizationInputSchema),z.lazy(() => LocationUncheckedCreateWithoutOrganizationInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => LocationCreateOrConnectWithoutOrganizationInputSchema),z.lazy(() => LocationCreateOrConnectWithoutOrganizationInputSchema).array() ]).optional(),
  createMany: z.lazy(() => LocationCreateManyOrganizationInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => LocationWhereUniqueInputSchema),z.lazy(() => LocationWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default LocationUncheckedCreateNestedManyWithoutOrganizationInputSchema;
