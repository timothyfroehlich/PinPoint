import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateWithoutCreatedByInputSchema } from './IssueCreateWithoutCreatedByInputSchema';
import { IssueUncheckedCreateWithoutCreatedByInputSchema } from './IssueUncheckedCreateWithoutCreatedByInputSchema';
import { IssueCreateOrConnectWithoutCreatedByInputSchema } from './IssueCreateOrConnectWithoutCreatedByInputSchema';
import { IssueCreateManyCreatedByInputEnvelopeSchema } from './IssueCreateManyCreatedByInputEnvelopeSchema';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';

export const IssueUncheckedCreateNestedManyWithoutCreatedByInputSchema: z.ZodType<Prisma.IssueUncheckedCreateNestedManyWithoutCreatedByInput> = z.object({
  create: z.union([ z.lazy(() => IssueCreateWithoutCreatedByInputSchema),z.lazy(() => IssueCreateWithoutCreatedByInputSchema).array(),z.lazy(() => IssueUncheckedCreateWithoutCreatedByInputSchema),z.lazy(() => IssueUncheckedCreateWithoutCreatedByInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => IssueCreateOrConnectWithoutCreatedByInputSchema),z.lazy(() => IssueCreateOrConnectWithoutCreatedByInputSchema).array() ]).optional(),
  createMany: z.lazy(() => IssueCreateManyCreatedByInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => IssueWhereUniqueInputSchema),z.lazy(() => IssueWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default IssueUncheckedCreateNestedManyWithoutCreatedByInputSchema;
