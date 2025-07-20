import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueHistoryWhereUniqueInputSchema } from './IssueHistoryWhereUniqueInputSchema';
import { IssueHistoryCreateWithoutActorInputSchema } from './IssueHistoryCreateWithoutActorInputSchema';
import { IssueHistoryUncheckedCreateWithoutActorInputSchema } from './IssueHistoryUncheckedCreateWithoutActorInputSchema';

export const IssueHistoryCreateOrConnectWithoutActorInputSchema: z.ZodType<Prisma.IssueHistoryCreateOrConnectWithoutActorInput> = z.object({
  where: z.lazy(() => IssueHistoryWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => IssueHistoryCreateWithoutActorInputSchema),z.lazy(() => IssueHistoryUncheckedCreateWithoutActorInputSchema) ]),
}).strict();

export default IssueHistoryCreateOrConnectWithoutActorInputSchema;
