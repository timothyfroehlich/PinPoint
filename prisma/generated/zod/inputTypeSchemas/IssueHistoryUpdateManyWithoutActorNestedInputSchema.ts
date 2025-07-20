import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueHistoryCreateWithoutActorInputSchema } from './IssueHistoryCreateWithoutActorInputSchema';
import { IssueHistoryUncheckedCreateWithoutActorInputSchema } from './IssueHistoryUncheckedCreateWithoutActorInputSchema';
import { IssueHistoryCreateOrConnectWithoutActorInputSchema } from './IssueHistoryCreateOrConnectWithoutActorInputSchema';
import { IssueHistoryUpsertWithWhereUniqueWithoutActorInputSchema } from './IssueHistoryUpsertWithWhereUniqueWithoutActorInputSchema';
import { IssueHistoryCreateManyActorInputEnvelopeSchema } from './IssueHistoryCreateManyActorInputEnvelopeSchema';
import { IssueHistoryWhereUniqueInputSchema } from './IssueHistoryWhereUniqueInputSchema';
import { IssueHistoryUpdateWithWhereUniqueWithoutActorInputSchema } from './IssueHistoryUpdateWithWhereUniqueWithoutActorInputSchema';
import { IssueHistoryUpdateManyWithWhereWithoutActorInputSchema } from './IssueHistoryUpdateManyWithWhereWithoutActorInputSchema';
import { IssueHistoryScalarWhereInputSchema } from './IssueHistoryScalarWhereInputSchema';

export const IssueHistoryUpdateManyWithoutActorNestedInputSchema: z.ZodType<Prisma.IssueHistoryUpdateManyWithoutActorNestedInput> = z.object({
  create: z.union([ z.lazy(() => IssueHistoryCreateWithoutActorInputSchema),z.lazy(() => IssueHistoryCreateWithoutActorInputSchema).array(),z.lazy(() => IssueHistoryUncheckedCreateWithoutActorInputSchema),z.lazy(() => IssueHistoryUncheckedCreateWithoutActorInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => IssueHistoryCreateOrConnectWithoutActorInputSchema),z.lazy(() => IssueHistoryCreateOrConnectWithoutActorInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => IssueHistoryUpsertWithWhereUniqueWithoutActorInputSchema),z.lazy(() => IssueHistoryUpsertWithWhereUniqueWithoutActorInputSchema).array() ]).optional(),
  createMany: z.lazy(() => IssueHistoryCreateManyActorInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => IssueHistoryWhereUniqueInputSchema),z.lazy(() => IssueHistoryWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => IssueHistoryWhereUniqueInputSchema),z.lazy(() => IssueHistoryWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => IssueHistoryWhereUniqueInputSchema),z.lazy(() => IssueHistoryWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => IssueHistoryWhereUniqueInputSchema),z.lazy(() => IssueHistoryWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => IssueHistoryUpdateWithWhereUniqueWithoutActorInputSchema),z.lazy(() => IssueHistoryUpdateWithWhereUniqueWithoutActorInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => IssueHistoryUpdateManyWithWhereWithoutActorInputSchema),z.lazy(() => IssueHistoryUpdateManyWithWhereWithoutActorInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => IssueHistoryScalarWhereInputSchema),z.lazy(() => IssueHistoryScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default IssueHistoryUpdateManyWithoutActorNestedInputSchema;
