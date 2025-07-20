import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';
import { IssueUpdateWithoutOrganizationInputSchema } from './IssueUpdateWithoutOrganizationInputSchema';
import { IssueUncheckedUpdateWithoutOrganizationInputSchema } from './IssueUncheckedUpdateWithoutOrganizationInputSchema';
import { IssueCreateWithoutOrganizationInputSchema } from './IssueCreateWithoutOrganizationInputSchema';
import { IssueUncheckedCreateWithoutOrganizationInputSchema } from './IssueUncheckedCreateWithoutOrganizationInputSchema';

export const IssueUpsertWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueUpsertWithWhereUniqueWithoutOrganizationInput> = z.object({
  where: z.lazy(() => IssueWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => IssueUpdateWithoutOrganizationInputSchema),z.lazy(() => IssueUncheckedUpdateWithoutOrganizationInputSchema) ]),
  create: z.union([ z.lazy(() => IssueCreateWithoutOrganizationInputSchema),z.lazy(() => IssueUncheckedCreateWithoutOrganizationInputSchema) ]),
}).strict();

export default IssueUpsertWithWhereUniqueWithoutOrganizationInputSchema;
