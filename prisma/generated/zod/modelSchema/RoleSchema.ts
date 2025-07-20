import { z } from 'zod';
import { OrganizationWithRelationsSchema, OrganizationPartialWithRelationsSchema, OrganizationOptionalDefaultsWithRelationsSchema } from './OrganizationSchema'
import type { OrganizationWithRelations, OrganizationPartialWithRelations, OrganizationOptionalDefaultsWithRelations } from './OrganizationSchema'
import { MembershipWithRelationsSchema, MembershipPartialWithRelationsSchema, MembershipOptionalDefaultsWithRelationsSchema } from './MembershipSchema'
import type { MembershipWithRelations, MembershipPartialWithRelations, MembershipOptionalDefaultsWithRelations } from './MembershipSchema'
import { PermissionWithRelationsSchema, PermissionPartialWithRelationsSchema, PermissionOptionalDefaultsWithRelationsSchema } from './PermissionSchema'
import type { PermissionWithRelations, PermissionPartialWithRelations, PermissionOptionalDefaultsWithRelations } from './PermissionSchema'

/////////////////////////////////////////
// ROLE SCHEMA
/////////////////////////////////////////

export const RoleSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  organizationId: z.string(),
  isDefault: z.boolean(),
})

export type Role = z.infer<typeof RoleSchema>

/////////////////////////////////////////
// ROLE PARTIAL SCHEMA
/////////////////////////////////////////

export const RolePartialSchema = RoleSchema.partial()

export type RolePartial = z.infer<typeof RolePartialSchema>

/////////////////////////////////////////
// ROLE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const RoleOptionalDefaultsSchema = RoleSchema.merge(z.object({
  id: z.string().cuid().optional(),
  isDefault: z.boolean().optional(),
}))

export type RoleOptionalDefaults = z.infer<typeof RoleOptionalDefaultsSchema>

/////////////////////////////////////////
// ROLE RELATION SCHEMA
/////////////////////////////////////////

export type RoleRelations = {
  organization: OrganizationWithRelations;
  memberships: MembershipWithRelations[];
  permissions: PermissionWithRelations[];
};

export type RoleWithRelations = z.infer<typeof RoleSchema> & RoleRelations

export const RoleWithRelationsSchema: z.ZodType<RoleWithRelations> = RoleSchema.merge(z.object({
  organization: z.lazy(() => OrganizationWithRelationsSchema),
  memberships: z.lazy(() => MembershipWithRelationsSchema).array(),
  permissions: z.lazy(() => PermissionWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// ROLE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type RoleOptionalDefaultsRelations = {
  organization: OrganizationOptionalDefaultsWithRelations;
  memberships: MembershipOptionalDefaultsWithRelations[];
  permissions: PermissionOptionalDefaultsWithRelations[];
};

export type RoleOptionalDefaultsWithRelations = z.infer<typeof RoleOptionalDefaultsSchema> & RoleOptionalDefaultsRelations

export const RoleOptionalDefaultsWithRelationsSchema: z.ZodType<RoleOptionalDefaultsWithRelations> = RoleOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationOptionalDefaultsWithRelationsSchema),
  memberships: z.lazy(() => MembershipOptionalDefaultsWithRelationsSchema).array(),
  permissions: z.lazy(() => PermissionOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// ROLE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type RolePartialRelations = {
  organization?: OrganizationPartialWithRelations;
  memberships?: MembershipPartialWithRelations[];
  permissions?: PermissionPartialWithRelations[];
};

export type RolePartialWithRelations = z.infer<typeof RolePartialSchema> & RolePartialRelations

export const RolePartialWithRelationsSchema: z.ZodType<RolePartialWithRelations> = RolePartialSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  memberships: z.lazy(() => MembershipPartialWithRelationsSchema).array(),
  permissions: z.lazy(() => PermissionPartialWithRelationsSchema).array(),
})).partial()

export type RoleOptionalDefaultsWithPartialRelations = z.infer<typeof RoleOptionalDefaultsSchema> & RolePartialRelations

export const RoleOptionalDefaultsWithPartialRelationsSchema: z.ZodType<RoleOptionalDefaultsWithPartialRelations> = RoleOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  memberships: z.lazy(() => MembershipPartialWithRelationsSchema).array(),
  permissions: z.lazy(() => PermissionPartialWithRelationsSchema).array(),
}).partial())

export type RoleWithPartialRelations = z.infer<typeof RoleSchema> & RolePartialRelations

export const RoleWithPartialRelationsSchema: z.ZodType<RoleWithPartialRelations> = RoleSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  memberships: z.lazy(() => MembershipPartialWithRelationsSchema).array(),
  permissions: z.lazy(() => PermissionPartialWithRelationsSchema).array(),
}).partial())

export default RoleSchema;
