import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { PriorityScalarWhereInputSchema } from './PriorityScalarWhereInputSchema';
import { PriorityUpdateManyMutationInputSchema } from './PriorityUpdateManyMutationInputSchema';
import { PriorityUncheckedUpdateManyWithoutOrganizationInputSchema } from './PriorityUncheckedUpdateManyWithoutOrganizationInputSchema';

export const PriorityUpdateManyWithWhereWithoutOrganizationInputSchema: z.ZodType<Prisma.PriorityUpdateManyWithWhereWithoutOrganizationInput> = z.object({
  where: z.lazy(() => PriorityScalarWhereInputSchema),
  data: z.union([ z.lazy(() => PriorityUpdateManyMutationInputSchema),z.lazy(() => PriorityUncheckedUpdateManyWithoutOrganizationInputSchema) ]),
}).strict();

export default PriorityUpdateManyWithWhereWithoutOrganizationInputSchema;
