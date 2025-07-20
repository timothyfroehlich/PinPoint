import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';
import { SortOrderInputSchema } from './SortOrderInputSchema';
import { MembershipOrderByRelationAggregateInputSchema } from './MembershipOrderByRelationAggregateInputSchema';
import { LocationOrderByRelationAggregateInputSchema } from './LocationOrderByRelationAggregateInputSchema';
import { RoleOrderByRelationAggregateInputSchema } from './RoleOrderByRelationAggregateInputSchema';
import { MachineOrderByRelationAggregateInputSchema } from './MachineOrderByRelationAggregateInputSchema';
import { IssueOrderByRelationAggregateInputSchema } from './IssueOrderByRelationAggregateInputSchema';
import { PriorityOrderByRelationAggregateInputSchema } from './PriorityOrderByRelationAggregateInputSchema';
import { IssueStatusOrderByRelationAggregateInputSchema } from './IssueStatusOrderByRelationAggregateInputSchema';
import { CollectionTypeOrderByRelationAggregateInputSchema } from './CollectionTypeOrderByRelationAggregateInputSchema';
import { IssueHistoryOrderByRelationAggregateInputSchema } from './IssueHistoryOrderByRelationAggregateInputSchema';
import { AttachmentOrderByRelationAggregateInputSchema } from './AttachmentOrderByRelationAggregateInputSchema';
import { PinballMapConfigOrderByWithRelationInputSchema } from './PinballMapConfigOrderByWithRelationInputSchema';

export const OrganizationOrderByWithRelationInputSchema: z.ZodType<Prisma.OrganizationOrderByWithRelationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  subdomain: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  logoUrl: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  memberships: z.lazy(() => MembershipOrderByRelationAggregateInputSchema).optional(),
  locations: z.lazy(() => LocationOrderByRelationAggregateInputSchema).optional(),
  roles: z.lazy(() => RoleOrderByRelationAggregateInputSchema).optional(),
  machines: z.lazy(() => MachineOrderByRelationAggregateInputSchema).optional(),
  issues: z.lazy(() => IssueOrderByRelationAggregateInputSchema).optional(),
  priorities: z.lazy(() => PriorityOrderByRelationAggregateInputSchema).optional(),
  issueStatuses: z.lazy(() => IssueStatusOrderByRelationAggregateInputSchema).optional(),
  collectionTypes: z.lazy(() => CollectionTypeOrderByRelationAggregateInputSchema).optional(),
  issueHistory: z.lazy(() => IssueHistoryOrderByRelationAggregateInputSchema).optional(),
  attachments: z.lazy(() => AttachmentOrderByRelationAggregateInputSchema).optional(),
  pinballMapConfig: z.lazy(() => PinballMapConfigOrderByWithRelationInputSchema).optional()
}).strict();

export default OrganizationOrderByWithRelationInputSchema;
