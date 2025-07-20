import { z } from 'zod';
import { MembershipWithRelationsSchema, MembershipPartialWithRelationsSchema, MembershipOptionalDefaultsWithRelationsSchema } from './MembershipSchema'
import type { MembershipWithRelations, MembershipPartialWithRelations, MembershipOptionalDefaultsWithRelations } from './MembershipSchema'
import { LocationWithRelationsSchema, LocationPartialWithRelationsSchema, LocationOptionalDefaultsWithRelationsSchema } from './LocationSchema'
import type { LocationWithRelations, LocationPartialWithRelations, LocationOptionalDefaultsWithRelations } from './LocationSchema'
import { RoleWithRelationsSchema, RolePartialWithRelationsSchema, RoleOptionalDefaultsWithRelationsSchema } from './RoleSchema'
import type { RoleWithRelations, RolePartialWithRelations, RoleOptionalDefaultsWithRelations } from './RoleSchema'
import { MachineWithRelationsSchema, MachinePartialWithRelationsSchema, MachineOptionalDefaultsWithRelationsSchema } from './MachineSchema'
import type { MachineWithRelations, MachinePartialWithRelations, MachineOptionalDefaultsWithRelations } from './MachineSchema'
import { IssueWithRelationsSchema, IssuePartialWithRelationsSchema, IssueOptionalDefaultsWithRelationsSchema } from './IssueSchema'
import type { IssueWithRelations, IssuePartialWithRelations, IssueOptionalDefaultsWithRelations } from './IssueSchema'
import { PriorityWithRelationsSchema, PriorityPartialWithRelationsSchema, PriorityOptionalDefaultsWithRelationsSchema } from './PrioritySchema'
import type { PriorityWithRelations, PriorityPartialWithRelations, PriorityOptionalDefaultsWithRelations } from './PrioritySchema'
import { IssueStatusWithRelationsSchema, IssueStatusPartialWithRelationsSchema, IssueStatusOptionalDefaultsWithRelationsSchema } from './IssueStatusSchema'
import type { IssueStatusWithRelations, IssueStatusPartialWithRelations, IssueStatusOptionalDefaultsWithRelations } from './IssueStatusSchema'
import { CollectionTypeWithRelationsSchema, CollectionTypePartialWithRelationsSchema, CollectionTypeOptionalDefaultsWithRelationsSchema } from './CollectionTypeSchema'
import type { CollectionTypeWithRelations, CollectionTypePartialWithRelations, CollectionTypeOptionalDefaultsWithRelations } from './CollectionTypeSchema'
import { IssueHistoryWithRelationsSchema, IssueHistoryPartialWithRelationsSchema, IssueHistoryOptionalDefaultsWithRelationsSchema } from './IssueHistorySchema'
import type { IssueHistoryWithRelations, IssueHistoryPartialWithRelations, IssueHistoryOptionalDefaultsWithRelations } from './IssueHistorySchema'
import { AttachmentWithRelationsSchema, AttachmentPartialWithRelationsSchema, AttachmentOptionalDefaultsWithRelationsSchema } from './AttachmentSchema'
import type { AttachmentWithRelations, AttachmentPartialWithRelations, AttachmentOptionalDefaultsWithRelations } from './AttachmentSchema'
import { PinballMapConfigWithRelationsSchema, PinballMapConfigPartialWithRelationsSchema, PinballMapConfigOptionalDefaultsWithRelationsSchema } from './PinballMapConfigSchema'
import type { PinballMapConfigWithRelations, PinballMapConfigPartialWithRelations, PinballMapConfigOptionalDefaultsWithRelations } from './PinballMapConfigSchema'

/////////////////////////////////////////
// ORGANIZATION SCHEMA
/////////////////////////////////////////

export const OrganizationSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  subdomain: z.string().nullable(),
  logoUrl: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Organization = z.infer<typeof OrganizationSchema>

/////////////////////////////////////////
// ORGANIZATION PARTIAL SCHEMA
/////////////////////////////////////////

export const OrganizationPartialSchema = OrganizationSchema.partial()

export type OrganizationPartial = z.infer<typeof OrganizationPartialSchema>

/////////////////////////////////////////
// ORGANIZATION OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const OrganizationOptionalDefaultsSchema = OrganizationSchema.merge(z.object({
  id: z.string().cuid().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type OrganizationOptionalDefaults = z.infer<typeof OrganizationOptionalDefaultsSchema>

/////////////////////////////////////////
// ORGANIZATION RELATION SCHEMA
/////////////////////////////////////////

export type OrganizationRelations = {
  memberships: MembershipWithRelations[];
  locations: LocationWithRelations[];
  roles: RoleWithRelations[];
  machines: MachineWithRelations[];
  issues: IssueWithRelations[];
  priorities: PriorityWithRelations[];
  issueStatuses: IssueStatusWithRelations[];
  collectionTypes: CollectionTypeWithRelations[];
  issueHistory: IssueHistoryWithRelations[];
  attachments: AttachmentWithRelations[];
  pinballMapConfig?: PinballMapConfigWithRelations | null;
};

export type OrganizationWithRelations = z.infer<typeof OrganizationSchema> & OrganizationRelations

export const OrganizationWithRelationsSchema: z.ZodType<OrganizationWithRelations> = OrganizationSchema.merge(z.object({
  memberships: z.lazy(() => MembershipWithRelationsSchema).array(),
  locations: z.lazy(() => LocationWithRelationsSchema).array(),
  roles: z.lazy(() => RoleWithRelationsSchema).array(),
  machines: z.lazy(() => MachineWithRelationsSchema).array(),
  issues: z.lazy(() => IssueWithRelationsSchema).array(),
  priorities: z.lazy(() => PriorityWithRelationsSchema).array(),
  issueStatuses: z.lazy(() => IssueStatusWithRelationsSchema).array(),
  collectionTypes: z.lazy(() => CollectionTypeWithRelationsSchema).array(),
  issueHistory: z.lazy(() => IssueHistoryWithRelationsSchema).array(),
  attachments: z.lazy(() => AttachmentWithRelationsSchema).array(),
  pinballMapConfig: z.lazy(() => PinballMapConfigWithRelationsSchema).nullable(),
}))

/////////////////////////////////////////
// ORGANIZATION OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type OrganizationOptionalDefaultsRelations = {
  memberships: MembershipOptionalDefaultsWithRelations[];
  locations: LocationOptionalDefaultsWithRelations[];
  roles: RoleOptionalDefaultsWithRelations[];
  machines: MachineOptionalDefaultsWithRelations[];
  issues: IssueOptionalDefaultsWithRelations[];
  priorities: PriorityOptionalDefaultsWithRelations[];
  issueStatuses: IssueStatusOptionalDefaultsWithRelations[];
  collectionTypes: CollectionTypeOptionalDefaultsWithRelations[];
  issueHistory: IssueHistoryOptionalDefaultsWithRelations[];
  attachments: AttachmentOptionalDefaultsWithRelations[];
  pinballMapConfig?: PinballMapConfigOptionalDefaultsWithRelations | null;
};

export type OrganizationOptionalDefaultsWithRelations = z.infer<typeof OrganizationOptionalDefaultsSchema> & OrganizationOptionalDefaultsRelations

export const OrganizationOptionalDefaultsWithRelationsSchema: z.ZodType<OrganizationOptionalDefaultsWithRelations> = OrganizationOptionalDefaultsSchema.merge(z.object({
  memberships: z.lazy(() => MembershipOptionalDefaultsWithRelationsSchema).array(),
  locations: z.lazy(() => LocationOptionalDefaultsWithRelationsSchema).array(),
  roles: z.lazy(() => RoleOptionalDefaultsWithRelationsSchema).array(),
  machines: z.lazy(() => MachineOptionalDefaultsWithRelationsSchema).array(),
  issues: z.lazy(() => IssueOptionalDefaultsWithRelationsSchema).array(),
  priorities: z.lazy(() => PriorityOptionalDefaultsWithRelationsSchema).array(),
  issueStatuses: z.lazy(() => IssueStatusOptionalDefaultsWithRelationsSchema).array(),
  collectionTypes: z.lazy(() => CollectionTypeOptionalDefaultsWithRelationsSchema).array(),
  issueHistory: z.lazy(() => IssueHistoryOptionalDefaultsWithRelationsSchema).array(),
  attachments: z.lazy(() => AttachmentOptionalDefaultsWithRelationsSchema).array(),
  pinballMapConfig: z.lazy(() => PinballMapConfigOptionalDefaultsWithRelationsSchema).nullable(),
}))

/////////////////////////////////////////
// ORGANIZATION PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type OrganizationPartialRelations = {
  memberships?: MembershipPartialWithRelations[];
  locations?: LocationPartialWithRelations[];
  roles?: RolePartialWithRelations[];
  machines?: MachinePartialWithRelations[];
  issues?: IssuePartialWithRelations[];
  priorities?: PriorityPartialWithRelations[];
  issueStatuses?: IssueStatusPartialWithRelations[];
  collectionTypes?: CollectionTypePartialWithRelations[];
  issueHistory?: IssueHistoryPartialWithRelations[];
  attachments?: AttachmentPartialWithRelations[];
  pinballMapConfig?: PinballMapConfigPartialWithRelations | null;
};

export type OrganizationPartialWithRelations = z.infer<typeof OrganizationPartialSchema> & OrganizationPartialRelations

export const OrganizationPartialWithRelationsSchema: z.ZodType<OrganizationPartialWithRelations> = OrganizationPartialSchema.merge(z.object({
  memberships: z.lazy(() => MembershipPartialWithRelationsSchema).array(),
  locations: z.lazy(() => LocationPartialWithRelationsSchema).array(),
  roles: z.lazy(() => RolePartialWithRelationsSchema).array(),
  machines: z.lazy(() => MachinePartialWithRelationsSchema).array(),
  issues: z.lazy(() => IssuePartialWithRelationsSchema).array(),
  priorities: z.lazy(() => PriorityPartialWithRelationsSchema).array(),
  issueStatuses: z.lazy(() => IssueStatusPartialWithRelationsSchema).array(),
  collectionTypes: z.lazy(() => CollectionTypePartialWithRelationsSchema).array(),
  issueHistory: z.lazy(() => IssueHistoryPartialWithRelationsSchema).array(),
  attachments: z.lazy(() => AttachmentPartialWithRelationsSchema).array(),
  pinballMapConfig: z.lazy(() => PinballMapConfigPartialWithRelationsSchema).nullable(),
})).partial()

export type OrganizationOptionalDefaultsWithPartialRelations = z.infer<typeof OrganizationOptionalDefaultsSchema> & OrganizationPartialRelations

export const OrganizationOptionalDefaultsWithPartialRelationsSchema: z.ZodType<OrganizationOptionalDefaultsWithPartialRelations> = OrganizationOptionalDefaultsSchema.merge(z.object({
  memberships: z.lazy(() => MembershipPartialWithRelationsSchema).array(),
  locations: z.lazy(() => LocationPartialWithRelationsSchema).array(),
  roles: z.lazy(() => RolePartialWithRelationsSchema).array(),
  machines: z.lazy(() => MachinePartialWithRelationsSchema).array(),
  issues: z.lazy(() => IssuePartialWithRelationsSchema).array(),
  priorities: z.lazy(() => PriorityPartialWithRelationsSchema).array(),
  issueStatuses: z.lazy(() => IssueStatusPartialWithRelationsSchema).array(),
  collectionTypes: z.lazy(() => CollectionTypePartialWithRelationsSchema).array(),
  issueHistory: z.lazy(() => IssueHistoryPartialWithRelationsSchema).array(),
  attachments: z.lazy(() => AttachmentPartialWithRelationsSchema).array(),
  pinballMapConfig: z.lazy(() => PinballMapConfigPartialWithRelationsSchema).nullable(),
}).partial())

export type OrganizationWithPartialRelations = z.infer<typeof OrganizationSchema> & OrganizationPartialRelations

export const OrganizationWithPartialRelationsSchema: z.ZodType<OrganizationWithPartialRelations> = OrganizationSchema.merge(z.object({
  memberships: z.lazy(() => MembershipPartialWithRelationsSchema).array(),
  locations: z.lazy(() => LocationPartialWithRelationsSchema).array(),
  roles: z.lazy(() => RolePartialWithRelationsSchema).array(),
  machines: z.lazy(() => MachinePartialWithRelationsSchema).array(),
  issues: z.lazy(() => IssuePartialWithRelationsSchema).array(),
  priorities: z.lazy(() => PriorityPartialWithRelationsSchema).array(),
  issueStatuses: z.lazy(() => IssueStatusPartialWithRelationsSchema).array(),
  collectionTypes: z.lazy(() => CollectionTypePartialWithRelationsSchema).array(),
  issueHistory: z.lazy(() => IssueHistoryPartialWithRelationsSchema).array(),
  attachments: z.lazy(() => AttachmentPartialWithRelationsSchema).array(),
  pinballMapConfig: z.lazy(() => PinballMapConfigPartialWithRelationsSchema).nullable(),
}).partial())

export default OrganizationSchema;
