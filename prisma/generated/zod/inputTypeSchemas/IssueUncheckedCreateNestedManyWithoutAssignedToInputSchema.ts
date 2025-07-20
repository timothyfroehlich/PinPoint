import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateWithoutAssignedToInputSchema } from './IssueCreateWithoutAssignedToInputSchema';
import { IssueUncheckedCreateWithoutAssignedToInputSchema } from './IssueUncheckedCreateWithoutAssignedToInputSchema';
import { IssueCreateOrConnectWithoutAssignedToInputSchema } from './IssueCreateOrConnectWithoutAssignedToInputSchema';
import { IssueCreateManyAssignedToInputEnvelopeSchema } from './IssueCreateManyAssignedToInputEnvelopeSchema';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';

export const IssueUncheckedCreateNestedManyWithoutAssignedToInputSchema: z.ZodType<Prisma.IssueUncheckedCreateNestedManyWithoutAssignedToInput> = z.object({
  create: z.union([ z.lazy(() => IssueCreateWithoutAssignedToInputSchema),z.lazy(() => IssueCreateWithoutAssignedToInputSchema).array(),z.lazy(() => IssueUncheckedCreateWithoutAssignedToInputSchema),z.lazy(() => IssueUncheckedCreateWithoutAssignedToInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => IssueCreateOrConnectWithoutAssignedToInputSchema),z.lazy(() => IssueCreateOrConnectWithoutAssignedToInputSchema).array() ]).optional(),
  createMany: z.lazy(() => IssueCreateManyAssignedToInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => IssueWhereUniqueInputSchema),z.lazy(() => IssueWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default IssueUncheckedCreateNestedManyWithoutAssignedToInputSchema;
