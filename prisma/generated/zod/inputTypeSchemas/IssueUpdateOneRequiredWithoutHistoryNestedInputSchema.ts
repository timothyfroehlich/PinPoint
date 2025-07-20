import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateWithoutHistoryInputSchema } from './IssueCreateWithoutHistoryInputSchema';
import { IssueUncheckedCreateWithoutHistoryInputSchema } from './IssueUncheckedCreateWithoutHistoryInputSchema';
import { IssueCreateOrConnectWithoutHistoryInputSchema } from './IssueCreateOrConnectWithoutHistoryInputSchema';
import { IssueUpsertWithoutHistoryInputSchema } from './IssueUpsertWithoutHistoryInputSchema';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';
import { IssueUpdateToOneWithWhereWithoutHistoryInputSchema } from './IssueUpdateToOneWithWhereWithoutHistoryInputSchema';
import { IssueUpdateWithoutHistoryInputSchema } from './IssueUpdateWithoutHistoryInputSchema';
import { IssueUncheckedUpdateWithoutHistoryInputSchema } from './IssueUncheckedUpdateWithoutHistoryInputSchema';

export const IssueUpdateOneRequiredWithoutHistoryNestedInputSchema: z.ZodType<Prisma.IssueUpdateOneRequiredWithoutHistoryNestedInput> = z.object({
  create: z.union([ z.lazy(() => IssueCreateWithoutHistoryInputSchema),z.lazy(() => IssueUncheckedCreateWithoutHistoryInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => IssueCreateOrConnectWithoutHistoryInputSchema).optional(),
  upsert: z.lazy(() => IssueUpsertWithoutHistoryInputSchema).optional(),
  connect: z.lazy(() => IssueWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => IssueUpdateToOneWithWhereWithoutHistoryInputSchema),z.lazy(() => IssueUpdateWithoutHistoryInputSchema),z.lazy(() => IssueUncheckedUpdateWithoutHistoryInputSchema) ]).optional(),
}).strict();

export default IssueUpdateOneRequiredWithoutHistoryNestedInputSchema;
