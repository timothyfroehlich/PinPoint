import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateWithoutAssignedToInputSchema } from './IssueCreateWithoutAssignedToInputSchema';
import { IssueUncheckedCreateWithoutAssignedToInputSchema } from './IssueUncheckedCreateWithoutAssignedToInputSchema';
import { IssueCreateOrConnectWithoutAssignedToInputSchema } from './IssueCreateOrConnectWithoutAssignedToInputSchema';
import { IssueUpsertWithWhereUniqueWithoutAssignedToInputSchema } from './IssueUpsertWithWhereUniqueWithoutAssignedToInputSchema';
import { IssueCreateManyAssignedToInputEnvelopeSchema } from './IssueCreateManyAssignedToInputEnvelopeSchema';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';
import { IssueUpdateWithWhereUniqueWithoutAssignedToInputSchema } from './IssueUpdateWithWhereUniqueWithoutAssignedToInputSchema';
import { IssueUpdateManyWithWhereWithoutAssignedToInputSchema } from './IssueUpdateManyWithWhereWithoutAssignedToInputSchema';
import { IssueScalarWhereInputSchema } from './IssueScalarWhereInputSchema';

export const IssueUpdateManyWithoutAssignedToNestedInputSchema: z.ZodType<Prisma.IssueUpdateManyWithoutAssignedToNestedInput> = z.object({
  create: z.union([ z.lazy(() => IssueCreateWithoutAssignedToInputSchema),z.lazy(() => IssueCreateWithoutAssignedToInputSchema).array(),z.lazy(() => IssueUncheckedCreateWithoutAssignedToInputSchema),z.lazy(() => IssueUncheckedCreateWithoutAssignedToInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => IssueCreateOrConnectWithoutAssignedToInputSchema),z.lazy(() => IssueCreateOrConnectWithoutAssignedToInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => IssueUpsertWithWhereUniqueWithoutAssignedToInputSchema),z.lazy(() => IssueUpsertWithWhereUniqueWithoutAssignedToInputSchema).array() ]).optional(),
  createMany: z.lazy(() => IssueCreateManyAssignedToInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => IssueWhereUniqueInputSchema),z.lazy(() => IssueWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => IssueWhereUniqueInputSchema),z.lazy(() => IssueWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => IssueWhereUniqueInputSchema),z.lazy(() => IssueWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => IssueWhereUniqueInputSchema),z.lazy(() => IssueWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => IssueUpdateWithWhereUniqueWithoutAssignedToInputSchema),z.lazy(() => IssueUpdateWithWhereUniqueWithoutAssignedToInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => IssueUpdateManyWithWhereWithoutAssignedToInputSchema),z.lazy(() => IssueUpdateManyWithWhereWithoutAssignedToInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => IssueScalarWhereInputSchema),z.lazy(() => IssueScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default IssueUpdateManyWithoutAssignedToNestedInputSchema;
