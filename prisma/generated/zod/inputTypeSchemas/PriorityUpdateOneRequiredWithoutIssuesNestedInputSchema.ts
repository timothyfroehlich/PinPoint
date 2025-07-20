import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { PriorityCreateWithoutIssuesInputSchema } from './PriorityCreateWithoutIssuesInputSchema';
import { PriorityUncheckedCreateWithoutIssuesInputSchema } from './PriorityUncheckedCreateWithoutIssuesInputSchema';
import { PriorityCreateOrConnectWithoutIssuesInputSchema } from './PriorityCreateOrConnectWithoutIssuesInputSchema';
import { PriorityUpsertWithoutIssuesInputSchema } from './PriorityUpsertWithoutIssuesInputSchema';
import { PriorityWhereUniqueInputSchema } from './PriorityWhereUniqueInputSchema';
import { PriorityUpdateToOneWithWhereWithoutIssuesInputSchema } from './PriorityUpdateToOneWithWhereWithoutIssuesInputSchema';
import { PriorityUpdateWithoutIssuesInputSchema } from './PriorityUpdateWithoutIssuesInputSchema';
import { PriorityUncheckedUpdateWithoutIssuesInputSchema } from './PriorityUncheckedUpdateWithoutIssuesInputSchema';

export const PriorityUpdateOneRequiredWithoutIssuesNestedInputSchema: z.ZodType<Prisma.PriorityUpdateOneRequiredWithoutIssuesNestedInput> = z.object({
  create: z.union([ z.lazy(() => PriorityCreateWithoutIssuesInputSchema),z.lazy(() => PriorityUncheckedCreateWithoutIssuesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => PriorityCreateOrConnectWithoutIssuesInputSchema).optional(),
  upsert: z.lazy(() => PriorityUpsertWithoutIssuesInputSchema).optional(),
  connect: z.lazy(() => PriorityWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => PriorityUpdateToOneWithWhereWithoutIssuesInputSchema),z.lazy(() => PriorityUpdateWithoutIssuesInputSchema),z.lazy(() => PriorityUncheckedUpdateWithoutIssuesInputSchema) ]).optional(),
}).strict();

export default PriorityUpdateOneRequiredWithoutIssuesNestedInputSchema;
