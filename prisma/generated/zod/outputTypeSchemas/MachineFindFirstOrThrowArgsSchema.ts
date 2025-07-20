import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { MachineIncludeSchema } from '../inputTypeSchemas/MachineIncludeSchema'
import { MachineWhereInputSchema } from '../inputTypeSchemas/MachineWhereInputSchema'
import { MachineOrderByWithRelationInputSchema } from '../inputTypeSchemas/MachineOrderByWithRelationInputSchema'
import { MachineWhereUniqueInputSchema } from '../inputTypeSchemas/MachineWhereUniqueInputSchema'
import { MachineScalarFieldEnumSchema } from '../inputTypeSchemas/MachineScalarFieldEnumSchema'
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema"
import { LocationArgsSchema } from "../outputTypeSchemas/LocationArgsSchema"
import { ModelArgsSchema } from "../outputTypeSchemas/ModelArgsSchema"
import { UserArgsSchema } from "../outputTypeSchemas/UserArgsSchema"
import { IssueFindManyArgsSchema } from "../outputTypeSchemas/IssueFindManyArgsSchema"
import { CollectionFindManyArgsSchema } from "../outputTypeSchemas/CollectionFindManyArgsSchema"
import { MachineCountOutputTypeArgsSchema } from "../outputTypeSchemas/MachineCountOutputTypeArgsSchema"
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const MachineSelectSchema: z.ZodType<Prisma.MachineSelect> = z.object({
  id: z.boolean().optional(),
  name: z.boolean().optional(),
  organizationId: z.boolean().optional(),
  locationId: z.boolean().optional(),
  modelId: z.boolean().optional(),
  ownerId: z.boolean().optional(),
  ownerNotificationsEnabled: z.boolean().optional(),
  notifyOnNewIssues: z.boolean().optional(),
  notifyOnStatusChanges: z.boolean().optional(),
  notifyOnComments: z.boolean().optional(),
  qrCodeId: z.boolean().optional(),
  qrCodeUrl: z.boolean().optional(),
  qrCodeGeneratedAt: z.boolean().optional(),
  organization: z.union([z.boolean(),z.lazy(() => OrganizationArgsSchema)]).optional(),
  location: z.union([z.boolean(),z.lazy(() => LocationArgsSchema)]).optional(),
  model: z.union([z.boolean(),z.lazy(() => ModelArgsSchema)]).optional(),
  owner: z.union([z.boolean(),z.lazy(() => UserArgsSchema)]).optional(),
  issues: z.union([z.boolean(),z.lazy(() => IssueFindManyArgsSchema)]).optional(),
  collections: z.union([z.boolean(),z.lazy(() => CollectionFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => MachineCountOutputTypeArgsSchema)]).optional(),
}).strict()

export const MachineFindFirstOrThrowArgsSchema: z.ZodType<Prisma.MachineFindFirstOrThrowArgs> = z.object({
  select: MachineSelectSchema.optional(),
  include: z.lazy(() => MachineIncludeSchema).optional(),
  where: MachineWhereInputSchema.optional(),
  orderBy: z.union([ MachineOrderByWithRelationInputSchema.array(),MachineOrderByWithRelationInputSchema ]).optional(),
  cursor: MachineWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ MachineScalarFieldEnumSchema,MachineScalarFieldEnumSchema.array() ]).optional(),
}).strict() ;

export default MachineFindFirstOrThrowArgsSchema;
