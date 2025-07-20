import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';
import { IssueCreateWithoutOrganizationInputSchema } from './IssueCreateWithoutOrganizationInputSchema';
import { IssueUncheckedCreateWithoutOrganizationInputSchema } from './IssueUncheckedCreateWithoutOrganizationInputSchema';

export const IssueCreateOrConnectWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueCreateOrConnectWithoutOrganizationInput> = z.object({
  where: z.lazy(() => IssueWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => IssueCreateWithoutOrganizationInputSchema),z.lazy(() => IssueUncheckedCreateWithoutOrganizationInputSchema) ]),
}).strict();

export default IssueCreateOrConnectWithoutOrganizationInputSchema;
