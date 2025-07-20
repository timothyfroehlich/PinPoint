import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { PinballMapConfigCreateWithoutOrganizationInputSchema } from './PinballMapConfigCreateWithoutOrganizationInputSchema';
import { PinballMapConfigUncheckedCreateWithoutOrganizationInputSchema } from './PinballMapConfigUncheckedCreateWithoutOrganizationInputSchema';
import { PinballMapConfigCreateOrConnectWithoutOrganizationInputSchema } from './PinballMapConfigCreateOrConnectWithoutOrganizationInputSchema';
import { PinballMapConfigWhereUniqueInputSchema } from './PinballMapConfigWhereUniqueInputSchema';

export const PinballMapConfigCreateNestedOneWithoutOrganizationInputSchema: z.ZodType<Prisma.PinballMapConfigCreateNestedOneWithoutOrganizationInput> = z.object({
  create: z.union([ z.lazy(() => PinballMapConfigCreateWithoutOrganizationInputSchema),z.lazy(() => PinballMapConfigUncheckedCreateWithoutOrganizationInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => PinballMapConfigCreateOrConnectWithoutOrganizationInputSchema).optional(),
  connect: z.lazy(() => PinballMapConfigWhereUniqueInputSchema).optional()
}).strict();

export default PinballMapConfigCreateNestedOneWithoutOrganizationInputSchema;
