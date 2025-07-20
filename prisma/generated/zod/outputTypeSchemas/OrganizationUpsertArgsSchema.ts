import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { OrganizationIncludeSchema } from '../inputTypeSchemas/OrganizationIncludeSchema'
import { OrganizationWhereUniqueInputSchema } from '../inputTypeSchemas/OrganizationWhereUniqueInputSchema'
import { OrganizationCreateInputSchema } from '../inputTypeSchemas/OrganizationCreateInputSchema'
import { OrganizationUncheckedCreateInputSchema } from '../inputTypeSchemas/OrganizationUncheckedCreateInputSchema'
import { OrganizationUpdateInputSchema } from '../inputTypeSchemas/OrganizationUpdateInputSchema'
import { OrganizationUncheckedUpdateInputSchema } from '../inputTypeSchemas/OrganizationUncheckedUpdateInputSchema'
import { MembershipFindManyArgsSchema } from "../outputTypeSchemas/MembershipFindManyArgsSchema"
import { LocationFindManyArgsSchema } from "../outputTypeSchemas/LocationFindManyArgsSchema"
import { RoleFindManyArgsSchema } from "../outputTypeSchemas/RoleFindManyArgsSchema"
import { MachineFindManyArgsSchema } from "../outputTypeSchemas/MachineFindManyArgsSchema"
import { IssueFindManyArgsSchema } from "../outputTypeSchemas/IssueFindManyArgsSchema"
import { PriorityFindManyArgsSchema } from "../outputTypeSchemas/PriorityFindManyArgsSchema"
import { IssueStatusFindManyArgsSchema } from "../outputTypeSchemas/IssueStatusFindManyArgsSchema"
import { CollectionTypeFindManyArgsSchema } from "../outputTypeSchemas/CollectionTypeFindManyArgsSchema"
import { IssueHistoryFindManyArgsSchema } from "../outputTypeSchemas/IssueHistoryFindManyArgsSchema"
import { AttachmentFindManyArgsSchema } from "../outputTypeSchemas/AttachmentFindManyArgsSchema"
import { PinballMapConfigArgsSchema } from "../outputTypeSchemas/PinballMapConfigArgsSchema"
import { OrganizationCountOutputTypeArgsSchema } from "../outputTypeSchemas/OrganizationCountOutputTypeArgsSchema"
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const OrganizationSelectSchema: z.ZodType<Prisma.OrganizationSelect> = z.object({
  id: z.boolean().optional(),
  name: z.boolean().optional(),
  subdomain: z.boolean().optional(),
  logoUrl: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  memberships: z.union([z.boolean(),z.lazy(() => MembershipFindManyArgsSchema)]).optional(),
  locations: z.union([z.boolean(),z.lazy(() => LocationFindManyArgsSchema)]).optional(),
  roles: z.union([z.boolean(),z.lazy(() => RoleFindManyArgsSchema)]).optional(),
  machines: z.union([z.boolean(),z.lazy(() => MachineFindManyArgsSchema)]).optional(),
  issues: z.union([z.boolean(),z.lazy(() => IssueFindManyArgsSchema)]).optional(),
  priorities: z.union([z.boolean(),z.lazy(() => PriorityFindManyArgsSchema)]).optional(),
  issueStatuses: z.union([z.boolean(),z.lazy(() => IssueStatusFindManyArgsSchema)]).optional(),
  collectionTypes: z.union([z.boolean(),z.lazy(() => CollectionTypeFindManyArgsSchema)]).optional(),
  issueHistory: z.union([z.boolean(),z.lazy(() => IssueHistoryFindManyArgsSchema)]).optional(),
  attachments: z.union([z.boolean(),z.lazy(() => AttachmentFindManyArgsSchema)]).optional(),
  pinballMapConfig: z.union([z.boolean(),z.lazy(() => PinballMapConfigArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => OrganizationCountOutputTypeArgsSchema)]).optional(),
}).strict()

export const OrganizationUpsertArgsSchema: z.ZodType<Prisma.OrganizationUpsertArgs> = z.object({
  select: OrganizationSelectSchema.optional(),
  include: z.lazy(() => OrganizationIncludeSchema).optional(),
  where: OrganizationWhereUniqueInputSchema,
  create: z.union([ OrganizationCreateInputSchema,OrganizationUncheckedCreateInputSchema ]),
  update: z.union([ OrganizationUpdateInputSchema,OrganizationUncheckedUpdateInputSchema ]),
}).strict() ;

export default OrganizationUpsertArgsSchema;
