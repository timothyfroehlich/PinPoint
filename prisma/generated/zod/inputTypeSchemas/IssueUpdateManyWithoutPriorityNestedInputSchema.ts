import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateWithoutPriorityInputSchema } from './IssueCreateWithoutPriorityInputSchema';
import { IssueUncheckedCreateWithoutPriorityInputSchema } from './IssueUncheckedCreateWithoutPriorityInputSchema';
import { IssueCreateOrConnectWithoutPriorityInputSchema } from './IssueCreateOrConnectWithoutPriorityInputSchema';
import { IssueUpsertWithWhereUniqueWithoutPriorityInputSchema } from './IssueUpsertWithWhereUniqueWithoutPriorityInputSchema';
import { IssueCreateManyPriorityInputEnvelopeSchema } from './IssueCreateManyPriorityInputEnvelopeSchema';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';
import { IssueUpdateWithWhereUniqueWithoutPriorityInputSchema } from './IssueUpdateWithWhereUniqueWithoutPriorityInputSchema';
import { IssueUpdateManyWithWhereWithoutPriorityInputSchema } from './IssueUpdateManyWithWhereWithoutPriorityInputSchema';
import { IssueScalarWhereInputSchema } from './IssueScalarWhereInputSchema';

export const IssueUpdateManyWithoutPriorityNestedInputSchema: z.ZodType<Prisma.IssueUpdateManyWithoutPriorityNestedInput> = z.object({
  create: z.union([ z.lazy(() => IssueCreateWithoutPriorityInputSchema),z.lazy(() => IssueCreateWithoutPriorityInputSchema).array(),z.lazy(() => IssueUncheckedCreateWithoutPriorityInputSchema),z.lazy(() => IssueUncheckedCreateWithoutPriorityInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => IssueCreateOrConnectWithoutPriorityInputSchema),z.lazy(() => IssueCreateOrConnectWithoutPriorityInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => IssueUpsertWithWhereUniqueWithoutPriorityInputSchema),z.lazy(() => IssueUpsertWithWhereUniqueWithoutPriorityInputSchema).array() ]).optional(),
  createMany: z.lazy(() => IssueCreateManyPriorityInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => IssueWhereUniqueInputSchema),z.lazy(() => IssueWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => IssueWhereUniqueInputSchema),z.lazy(() => IssueWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => IssueWhereUniqueInputSchema),z.lazy(() => IssueWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => IssueWhereUniqueInputSchema),z.lazy(() => IssueWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => IssueUpdateWithWhereUniqueWithoutPriorityInputSchema),z.lazy(() => IssueUpdateWithWhereUniqueWithoutPriorityInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => IssueUpdateManyWithWhereWithoutPriorityInputSchema),z.lazy(() => IssueUpdateManyWithWhereWithoutPriorityInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => IssueScalarWhereInputSchema),z.lazy(() => IssueScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default IssueUpdateManyWithoutPriorityNestedInputSchema;
