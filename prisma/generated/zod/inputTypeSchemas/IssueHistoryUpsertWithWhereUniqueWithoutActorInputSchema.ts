import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueHistoryWhereUniqueInputSchema } from './IssueHistoryWhereUniqueInputSchema';
import { IssueHistoryUpdateWithoutActorInputSchema } from './IssueHistoryUpdateWithoutActorInputSchema';
import { IssueHistoryUncheckedUpdateWithoutActorInputSchema } from './IssueHistoryUncheckedUpdateWithoutActorInputSchema';
import { IssueHistoryCreateWithoutActorInputSchema } from './IssueHistoryCreateWithoutActorInputSchema';
import { IssueHistoryUncheckedCreateWithoutActorInputSchema } from './IssueHistoryUncheckedCreateWithoutActorInputSchema';

export const IssueHistoryUpsertWithWhereUniqueWithoutActorInputSchema: z.ZodType<Prisma.IssueHistoryUpsertWithWhereUniqueWithoutActorInput> = z.object({
  where: z.lazy(() => IssueHistoryWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => IssueHistoryUpdateWithoutActorInputSchema),z.lazy(() => IssueHistoryUncheckedUpdateWithoutActorInputSchema) ]),
  create: z.union([ z.lazy(() => IssueHistoryCreateWithoutActorInputSchema),z.lazy(() => IssueHistoryUncheckedCreateWithoutActorInputSchema) ]),
}).strict();

export default IssueHistoryUpsertWithWhereUniqueWithoutActorInputSchema;
