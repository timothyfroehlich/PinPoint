import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateWithoutStatusInputSchema } from './IssueCreateWithoutStatusInputSchema';
import { IssueUncheckedCreateWithoutStatusInputSchema } from './IssueUncheckedCreateWithoutStatusInputSchema';
import { IssueCreateOrConnectWithoutStatusInputSchema } from './IssueCreateOrConnectWithoutStatusInputSchema';
import { IssueCreateManyStatusInputEnvelopeSchema } from './IssueCreateManyStatusInputEnvelopeSchema';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';

export const IssueUncheckedCreateNestedManyWithoutStatusInputSchema: z.ZodType<Prisma.IssueUncheckedCreateNestedManyWithoutStatusInput> = z.object({
  create: z.union([ z.lazy(() => IssueCreateWithoutStatusInputSchema),z.lazy(() => IssueCreateWithoutStatusInputSchema).array(),z.lazy(() => IssueUncheckedCreateWithoutStatusInputSchema),z.lazy(() => IssueUncheckedCreateWithoutStatusInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => IssueCreateOrConnectWithoutStatusInputSchema),z.lazy(() => IssueCreateOrConnectWithoutStatusInputSchema).array() ]).optional(),
  createMany: z.lazy(() => IssueCreateManyStatusInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => IssueWhereUniqueInputSchema),z.lazy(() => IssueWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default IssueUncheckedCreateNestedManyWithoutStatusInputSchema;
