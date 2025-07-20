import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateWithoutStatusInputSchema } from './IssueCreateWithoutStatusInputSchema';
import { IssueUncheckedCreateWithoutStatusInputSchema } from './IssueUncheckedCreateWithoutStatusInputSchema';
import { IssueCreateOrConnectWithoutStatusInputSchema } from './IssueCreateOrConnectWithoutStatusInputSchema';
import { IssueUpsertWithWhereUniqueWithoutStatusInputSchema } from './IssueUpsertWithWhereUniqueWithoutStatusInputSchema';
import { IssueCreateManyStatusInputEnvelopeSchema } from './IssueCreateManyStatusInputEnvelopeSchema';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';
import { IssueUpdateWithWhereUniqueWithoutStatusInputSchema } from './IssueUpdateWithWhereUniqueWithoutStatusInputSchema';
import { IssueUpdateManyWithWhereWithoutStatusInputSchema } from './IssueUpdateManyWithWhereWithoutStatusInputSchema';
import { IssueScalarWhereInputSchema } from './IssueScalarWhereInputSchema';

export const IssueUpdateManyWithoutStatusNestedInputSchema: z.ZodType<Prisma.IssueUpdateManyWithoutStatusNestedInput> = z.object({
  create: z.union([ z.lazy(() => IssueCreateWithoutStatusInputSchema),z.lazy(() => IssueCreateWithoutStatusInputSchema).array(),z.lazy(() => IssueUncheckedCreateWithoutStatusInputSchema),z.lazy(() => IssueUncheckedCreateWithoutStatusInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => IssueCreateOrConnectWithoutStatusInputSchema),z.lazy(() => IssueCreateOrConnectWithoutStatusInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => IssueUpsertWithWhereUniqueWithoutStatusInputSchema),z.lazy(() => IssueUpsertWithWhereUniqueWithoutStatusInputSchema).array() ]).optional(),
  createMany: z.lazy(() => IssueCreateManyStatusInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => IssueWhereUniqueInputSchema),z.lazy(() => IssueWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => IssueWhereUniqueInputSchema),z.lazy(() => IssueWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => IssueWhereUniqueInputSchema),z.lazy(() => IssueWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => IssueWhereUniqueInputSchema),z.lazy(() => IssueWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => IssueUpdateWithWhereUniqueWithoutStatusInputSchema),z.lazy(() => IssueUpdateWithWhereUniqueWithoutStatusInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => IssueUpdateManyWithWhereWithoutStatusInputSchema),z.lazy(() => IssueUpdateManyWithWhereWithoutStatusInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => IssueScalarWhereInputSchema),z.lazy(() => IssueScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default IssueUpdateManyWithoutStatusNestedInputSchema;
