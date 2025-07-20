import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { PriorityWhereInputSchema } from './PriorityWhereInputSchema';
import { PriorityUpdateWithoutIssuesInputSchema } from './PriorityUpdateWithoutIssuesInputSchema';
import { PriorityUncheckedUpdateWithoutIssuesInputSchema } from './PriorityUncheckedUpdateWithoutIssuesInputSchema';

export const PriorityUpdateToOneWithWhereWithoutIssuesInputSchema: z.ZodType<Prisma.PriorityUpdateToOneWithWhereWithoutIssuesInput> = z.object({
  where: z.lazy(() => PriorityWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => PriorityUpdateWithoutIssuesInputSchema),z.lazy(() => PriorityUncheckedUpdateWithoutIssuesInputSchema) ]),
}).strict();

export default PriorityUpdateToOneWithWhereWithoutIssuesInputSchema;
