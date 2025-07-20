import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UpvoteCreateWithoutIssueInputSchema } from './UpvoteCreateWithoutIssueInputSchema';
import { UpvoteUncheckedCreateWithoutIssueInputSchema } from './UpvoteUncheckedCreateWithoutIssueInputSchema';
import { UpvoteCreateOrConnectWithoutIssueInputSchema } from './UpvoteCreateOrConnectWithoutIssueInputSchema';
import { UpvoteUpsertWithWhereUniqueWithoutIssueInputSchema } from './UpvoteUpsertWithWhereUniqueWithoutIssueInputSchema';
import { UpvoteCreateManyIssueInputEnvelopeSchema } from './UpvoteCreateManyIssueInputEnvelopeSchema';
import { UpvoteWhereUniqueInputSchema } from './UpvoteWhereUniqueInputSchema';
import { UpvoteUpdateWithWhereUniqueWithoutIssueInputSchema } from './UpvoteUpdateWithWhereUniqueWithoutIssueInputSchema';
import { UpvoteUpdateManyWithWhereWithoutIssueInputSchema } from './UpvoteUpdateManyWithWhereWithoutIssueInputSchema';
import { UpvoteScalarWhereInputSchema } from './UpvoteScalarWhereInputSchema';

export const UpvoteUncheckedUpdateManyWithoutIssueNestedInputSchema: z.ZodType<Prisma.UpvoteUncheckedUpdateManyWithoutIssueNestedInput> = z.object({
  create: z.union([ z.lazy(() => UpvoteCreateWithoutIssueInputSchema),z.lazy(() => UpvoteCreateWithoutIssueInputSchema).array(),z.lazy(() => UpvoteUncheckedCreateWithoutIssueInputSchema),z.lazy(() => UpvoteUncheckedCreateWithoutIssueInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => UpvoteCreateOrConnectWithoutIssueInputSchema),z.lazy(() => UpvoteCreateOrConnectWithoutIssueInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => UpvoteUpsertWithWhereUniqueWithoutIssueInputSchema),z.lazy(() => UpvoteUpsertWithWhereUniqueWithoutIssueInputSchema).array() ]).optional(),
  createMany: z.lazy(() => UpvoteCreateManyIssueInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => UpvoteWhereUniqueInputSchema),z.lazy(() => UpvoteWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => UpvoteWhereUniqueInputSchema),z.lazy(() => UpvoteWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => UpvoteWhereUniqueInputSchema),z.lazy(() => UpvoteWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => UpvoteWhereUniqueInputSchema),z.lazy(() => UpvoteWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => UpvoteUpdateWithWhereUniqueWithoutIssueInputSchema),z.lazy(() => UpvoteUpdateWithWhereUniqueWithoutIssueInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => UpvoteUpdateManyWithWhereWithoutIssueInputSchema),z.lazy(() => UpvoteUpdateManyWithWhereWithoutIssueInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => UpvoteScalarWhereInputSchema),z.lazy(() => UpvoteScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default UpvoteUncheckedUpdateManyWithoutIssueNestedInputSchema;
