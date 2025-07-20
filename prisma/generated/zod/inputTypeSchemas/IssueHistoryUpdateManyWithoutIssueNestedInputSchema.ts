import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueHistoryCreateWithoutIssueInputSchema } from './IssueHistoryCreateWithoutIssueInputSchema';
import { IssueHistoryUncheckedCreateWithoutIssueInputSchema } from './IssueHistoryUncheckedCreateWithoutIssueInputSchema';
import { IssueHistoryCreateOrConnectWithoutIssueInputSchema } from './IssueHistoryCreateOrConnectWithoutIssueInputSchema';
import { IssueHistoryUpsertWithWhereUniqueWithoutIssueInputSchema } from './IssueHistoryUpsertWithWhereUniqueWithoutIssueInputSchema';
import { IssueHistoryCreateManyIssueInputEnvelopeSchema } from './IssueHistoryCreateManyIssueInputEnvelopeSchema';
import { IssueHistoryWhereUniqueInputSchema } from './IssueHistoryWhereUniqueInputSchema';
import { IssueHistoryUpdateWithWhereUniqueWithoutIssueInputSchema } from './IssueHistoryUpdateWithWhereUniqueWithoutIssueInputSchema';
import { IssueHistoryUpdateManyWithWhereWithoutIssueInputSchema } from './IssueHistoryUpdateManyWithWhereWithoutIssueInputSchema';
import { IssueHistoryScalarWhereInputSchema } from './IssueHistoryScalarWhereInputSchema';

export const IssueHistoryUpdateManyWithoutIssueNestedInputSchema: z.ZodType<Prisma.IssueHistoryUpdateManyWithoutIssueNestedInput> = z.object({
  create: z.union([ z.lazy(() => IssueHistoryCreateWithoutIssueInputSchema),z.lazy(() => IssueHistoryCreateWithoutIssueInputSchema).array(),z.lazy(() => IssueHistoryUncheckedCreateWithoutIssueInputSchema),z.lazy(() => IssueHistoryUncheckedCreateWithoutIssueInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => IssueHistoryCreateOrConnectWithoutIssueInputSchema),z.lazy(() => IssueHistoryCreateOrConnectWithoutIssueInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => IssueHistoryUpsertWithWhereUniqueWithoutIssueInputSchema),z.lazy(() => IssueHistoryUpsertWithWhereUniqueWithoutIssueInputSchema).array() ]).optional(),
  createMany: z.lazy(() => IssueHistoryCreateManyIssueInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => IssueHistoryWhereUniqueInputSchema),z.lazy(() => IssueHistoryWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => IssueHistoryWhereUniqueInputSchema),z.lazy(() => IssueHistoryWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => IssueHistoryWhereUniqueInputSchema),z.lazy(() => IssueHistoryWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => IssueHistoryWhereUniqueInputSchema),z.lazy(() => IssueHistoryWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => IssueHistoryUpdateWithWhereUniqueWithoutIssueInputSchema),z.lazy(() => IssueHistoryUpdateWithWhereUniqueWithoutIssueInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => IssueHistoryUpdateManyWithWhereWithoutIssueInputSchema),z.lazy(() => IssueHistoryUpdateManyWithWhereWithoutIssueInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => IssueHistoryScalarWhereInputSchema),z.lazy(() => IssueHistoryScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default IssueHistoryUpdateManyWithoutIssueNestedInputSchema;
