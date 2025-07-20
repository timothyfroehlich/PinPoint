import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFieldUpdateOperationsInputSchema } from './StringFieldUpdateOperationsInputSchema';
import { NullableStringFieldUpdateOperationsInputSchema } from './NullableStringFieldUpdateOperationsInputSchema';
import { DateTimeFieldUpdateOperationsInputSchema } from './DateTimeFieldUpdateOperationsInputSchema';
import { MembershipUpdateManyWithoutOrganizationNestedInputSchema } from './MembershipUpdateManyWithoutOrganizationNestedInputSchema';
import { LocationUpdateManyWithoutOrganizationNestedInputSchema } from './LocationUpdateManyWithoutOrganizationNestedInputSchema';
import { RoleUpdateManyWithoutOrganizationNestedInputSchema } from './RoleUpdateManyWithoutOrganizationNestedInputSchema';
import { MachineUpdateManyWithoutOrganizationNestedInputSchema } from './MachineUpdateManyWithoutOrganizationNestedInputSchema';
import { IssueUpdateManyWithoutOrganizationNestedInputSchema } from './IssueUpdateManyWithoutOrganizationNestedInputSchema';
import { IssueStatusUpdateManyWithoutOrganizationNestedInputSchema } from './IssueStatusUpdateManyWithoutOrganizationNestedInputSchema';
import { CollectionTypeUpdateManyWithoutOrganizationNestedInputSchema } from './CollectionTypeUpdateManyWithoutOrganizationNestedInputSchema';
import { IssueHistoryUpdateManyWithoutOrganizationNestedInputSchema } from './IssueHistoryUpdateManyWithoutOrganizationNestedInputSchema';
import { AttachmentUpdateManyWithoutOrganizationNestedInputSchema } from './AttachmentUpdateManyWithoutOrganizationNestedInputSchema';
import { PinballMapConfigUpdateOneWithoutOrganizationNestedInputSchema } from './PinballMapConfigUpdateOneWithoutOrganizationNestedInputSchema';

export const OrganizationUpdateWithoutPrioritiesInputSchema: z.ZodType<Prisma.OrganizationUpdateWithoutPrioritiesInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  subdomain: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  logoUrl: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  memberships: z.lazy(() => MembershipUpdateManyWithoutOrganizationNestedInputSchema).optional(),
  locations: z.lazy(() => LocationUpdateManyWithoutOrganizationNestedInputSchema).optional(),
  roles: z.lazy(() => RoleUpdateManyWithoutOrganizationNestedInputSchema).optional(),
  machines: z.lazy(() => MachineUpdateManyWithoutOrganizationNestedInputSchema).optional(),
  issues: z.lazy(() => IssueUpdateManyWithoutOrganizationNestedInputSchema).optional(),
  issueStatuses: z.lazy(() => IssueStatusUpdateManyWithoutOrganizationNestedInputSchema).optional(),
  collectionTypes: z.lazy(() => CollectionTypeUpdateManyWithoutOrganizationNestedInputSchema).optional(),
  issueHistory: z.lazy(() => IssueHistoryUpdateManyWithoutOrganizationNestedInputSchema).optional(),
  attachments: z.lazy(() => AttachmentUpdateManyWithoutOrganizationNestedInputSchema).optional(),
  pinballMapConfig: z.lazy(() => PinballMapConfigUpdateOneWithoutOrganizationNestedInputSchema).optional()
}).strict();

export default OrganizationUpdateWithoutPrioritiesInputSchema;
