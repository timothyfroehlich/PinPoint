import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';
import { StringFilterSchema } from './StringFilterSchema';
import { StringNullableFilterSchema } from './StringNullableFilterSchema';
import { DateTimeFilterSchema } from './DateTimeFilterSchema';
import { MembershipListRelationFilterSchema } from './MembershipListRelationFilterSchema';
import { LocationListRelationFilterSchema } from './LocationListRelationFilterSchema';
import { RoleListRelationFilterSchema } from './RoleListRelationFilterSchema';
import { MachineListRelationFilterSchema } from './MachineListRelationFilterSchema';
import { IssueListRelationFilterSchema } from './IssueListRelationFilterSchema';
import { PriorityListRelationFilterSchema } from './PriorityListRelationFilterSchema';
import { IssueStatusListRelationFilterSchema } from './IssueStatusListRelationFilterSchema';
import { CollectionTypeListRelationFilterSchema } from './CollectionTypeListRelationFilterSchema';
import { IssueHistoryListRelationFilterSchema } from './IssueHistoryListRelationFilterSchema';
import { AttachmentListRelationFilterSchema } from './AttachmentListRelationFilterSchema';
import { PinballMapConfigNullableScalarRelationFilterSchema } from './PinballMapConfigNullableScalarRelationFilterSchema';
import { PinballMapConfigWhereInputSchema } from './PinballMapConfigWhereInputSchema';

export const OrganizationWhereUniqueInputSchema: z.ZodType<Prisma.OrganizationWhereUniqueInput> = z.union([
  z.object({
    id: z.string().cuid(),
    subdomain: z.string()
  }),
  z.object({
    id: z.string().cuid(),
  }),
  z.object({
    subdomain: z.string(),
  }),
])
.and(z.object({
  id: z.string().cuid().optional(),
  subdomain: z.string().optional(),
  AND: z.union([ z.lazy(() => OrganizationWhereInputSchema),z.lazy(() => OrganizationWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => OrganizationWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => OrganizationWhereInputSchema),z.lazy(() => OrganizationWhereInputSchema).array() ]).optional(),
  name: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  logoUrl: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  memberships: z.lazy(() => MembershipListRelationFilterSchema).optional(),
  locations: z.lazy(() => LocationListRelationFilterSchema).optional(),
  roles: z.lazy(() => RoleListRelationFilterSchema).optional(),
  machines: z.lazy(() => MachineListRelationFilterSchema).optional(),
  issues: z.lazy(() => IssueListRelationFilterSchema).optional(),
  priorities: z.lazy(() => PriorityListRelationFilterSchema).optional(),
  issueStatuses: z.lazy(() => IssueStatusListRelationFilterSchema).optional(),
  collectionTypes: z.lazy(() => CollectionTypeListRelationFilterSchema).optional(),
  issueHistory: z.lazy(() => IssueHistoryListRelationFilterSchema).optional(),
  attachments: z.lazy(() => AttachmentListRelationFilterSchema).optional(),
  pinballMapConfig: z.union([ z.lazy(() => PinballMapConfigNullableScalarRelationFilterSchema),z.lazy(() => PinballMapConfigWhereInputSchema) ]).optional().nullable(),
}).strict());

export default OrganizationWhereUniqueInputSchema;
