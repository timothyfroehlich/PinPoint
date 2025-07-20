import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateWithoutOrganizationInputSchema } from './IssueCreateWithoutOrganizationInputSchema';
import { IssueUncheckedCreateWithoutOrganizationInputSchema } from './IssueUncheckedCreateWithoutOrganizationInputSchema';
import { IssueCreateOrConnectWithoutOrganizationInputSchema } from './IssueCreateOrConnectWithoutOrganizationInputSchema';
import { IssueCreateManyOrganizationInputEnvelopeSchema } from './IssueCreateManyOrganizationInputEnvelopeSchema';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';

export const IssueCreateNestedManyWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueCreateNestedManyWithoutOrganizationInput> = z.object({
  create: z.union([ z.lazy(() => IssueCreateWithoutOrganizationInputSchema),z.lazy(() => IssueCreateWithoutOrganizationInputSchema).array(),z.lazy(() => IssueUncheckedCreateWithoutOrganizationInputSchema),z.lazy(() => IssueUncheckedCreateWithoutOrganizationInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => IssueCreateOrConnectWithoutOrganizationInputSchema),z.lazy(() => IssueCreateOrConnectWithoutOrganizationInputSchema).array() ]).optional(),
  createMany: z.lazy(() => IssueCreateManyOrganizationInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => IssueWhereUniqueInputSchema),z.lazy(() => IssueWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default IssueCreateNestedManyWithoutOrganizationInputSchema;
