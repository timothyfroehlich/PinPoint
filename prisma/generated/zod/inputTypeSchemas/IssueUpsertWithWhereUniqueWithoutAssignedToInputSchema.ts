import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';
import { IssueUpdateWithoutAssignedToInputSchema } from './IssueUpdateWithoutAssignedToInputSchema';
import { IssueUncheckedUpdateWithoutAssignedToInputSchema } from './IssueUncheckedUpdateWithoutAssignedToInputSchema';
import { IssueCreateWithoutAssignedToInputSchema } from './IssueCreateWithoutAssignedToInputSchema';
import { IssueUncheckedCreateWithoutAssignedToInputSchema } from './IssueUncheckedCreateWithoutAssignedToInputSchema';

export const IssueUpsertWithWhereUniqueWithoutAssignedToInputSchema: z.ZodType<Prisma.IssueUpsertWithWhereUniqueWithoutAssignedToInput> = z.object({
  where: z.lazy(() => IssueWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => IssueUpdateWithoutAssignedToInputSchema),z.lazy(() => IssueUncheckedUpdateWithoutAssignedToInputSchema) ]),
  create: z.union([ z.lazy(() => IssueCreateWithoutAssignedToInputSchema),z.lazy(() => IssueUncheckedCreateWithoutAssignedToInputSchema) ]),
}).strict();

export default IssueUpsertWithWhereUniqueWithoutAssignedToInputSchema;
