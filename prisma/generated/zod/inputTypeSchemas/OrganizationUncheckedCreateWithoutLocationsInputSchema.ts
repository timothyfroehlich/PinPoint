import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MembershipUncheckedCreateNestedManyWithoutOrganizationInputSchema } from './MembershipUncheckedCreateNestedManyWithoutOrganizationInputSchema';
import { RoleUncheckedCreateNestedManyWithoutOrganizationInputSchema } from './RoleUncheckedCreateNestedManyWithoutOrganizationInputSchema';
import { MachineUncheckedCreateNestedManyWithoutOrganizationInputSchema } from './MachineUncheckedCreateNestedManyWithoutOrganizationInputSchema';
import { IssueUncheckedCreateNestedManyWithoutOrganizationInputSchema } from './IssueUncheckedCreateNestedManyWithoutOrganizationInputSchema';
import { PriorityUncheckedCreateNestedManyWithoutOrganizationInputSchema } from './PriorityUncheckedCreateNestedManyWithoutOrganizationInputSchema';
import { IssueStatusUncheckedCreateNestedManyWithoutOrganizationInputSchema } from './IssueStatusUncheckedCreateNestedManyWithoutOrganizationInputSchema';
import { CollectionTypeUncheckedCreateNestedManyWithoutOrganizationInputSchema } from './CollectionTypeUncheckedCreateNestedManyWithoutOrganizationInputSchema';
import { IssueHistoryUncheckedCreateNestedManyWithoutOrganizationInputSchema } from './IssueHistoryUncheckedCreateNestedManyWithoutOrganizationInputSchema';
import { AttachmentUncheckedCreateNestedManyWithoutOrganizationInputSchema } from './AttachmentUncheckedCreateNestedManyWithoutOrganizationInputSchema';
import { PinballMapConfigUncheckedCreateNestedOneWithoutOrganizationInputSchema } from './PinballMapConfigUncheckedCreateNestedOneWithoutOrganizationInputSchema';

export const OrganizationUncheckedCreateWithoutLocationsInputSchema: z.ZodType<Prisma.OrganizationUncheckedCreateWithoutLocationsInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  subdomain: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  memberships: z.lazy(() => MembershipUncheckedCreateNestedManyWithoutOrganizationInputSchema).optional(),
  roles: z.lazy(() => RoleUncheckedCreateNestedManyWithoutOrganizationInputSchema).optional(),
  machines: z.lazy(() => MachineUncheckedCreateNestedManyWithoutOrganizationInputSchema).optional(),
  issues: z.lazy(() => IssueUncheckedCreateNestedManyWithoutOrganizationInputSchema).optional(),
  priorities: z.lazy(() => PriorityUncheckedCreateNestedManyWithoutOrganizationInputSchema).optional(),
  issueStatuses: z.lazy(() => IssueStatusUncheckedCreateNestedManyWithoutOrganizationInputSchema).optional(),
  collectionTypes: z.lazy(() => CollectionTypeUncheckedCreateNestedManyWithoutOrganizationInputSchema).optional(),
  issueHistory: z.lazy(() => IssueHistoryUncheckedCreateNestedManyWithoutOrganizationInputSchema).optional(),
  attachments: z.lazy(() => AttachmentUncheckedCreateNestedManyWithoutOrganizationInputSchema).optional(),
  pinballMapConfig: z.lazy(() => PinballMapConfigUncheckedCreateNestedOneWithoutOrganizationInputSchema).optional()
}).strict();

export default OrganizationUncheckedCreateWithoutLocationsInputSchema;
