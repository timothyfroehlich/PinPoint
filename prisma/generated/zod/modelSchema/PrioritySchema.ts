import { z } from 'zod';
import { OrganizationWithRelationsSchema, OrganizationPartialWithRelationsSchema, OrganizationOptionalDefaultsWithRelationsSchema } from './OrganizationSchema'
import type { OrganizationWithRelations, OrganizationPartialWithRelations, OrganizationOptionalDefaultsWithRelations } from './OrganizationSchema'
import { IssueWithRelationsSchema, IssuePartialWithRelationsSchema, IssueOptionalDefaultsWithRelationsSchema } from './IssueSchema'
import type { IssueWithRelations, IssuePartialWithRelations, IssueOptionalDefaultsWithRelations } from './IssueSchema'

/////////////////////////////////////////
// PRIORITY SCHEMA
/////////////////////////////////////////

export const PrioritySchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  order: z.number().int(),
  organizationId: z.string(),
  isDefault: z.boolean(),
})

export type Priority = z.infer<typeof PrioritySchema>

/////////////////////////////////////////
// PRIORITY PARTIAL SCHEMA
/////////////////////////////////////////

export const PriorityPartialSchema = PrioritySchema.partial()

export type PriorityPartial = z.infer<typeof PriorityPartialSchema>

/////////////////////////////////////////
// PRIORITY OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const PriorityOptionalDefaultsSchema = PrioritySchema.merge(z.object({
  id: z.string().cuid().optional(),
  isDefault: z.boolean().optional(),
}))

export type PriorityOptionalDefaults = z.infer<typeof PriorityOptionalDefaultsSchema>

/////////////////////////////////////////
// PRIORITY RELATION SCHEMA
/////////////////////////////////////////

export type PriorityRelations = {
  organization: OrganizationWithRelations;
  issues: IssueWithRelations[];
};

export type PriorityWithRelations = z.infer<typeof PrioritySchema> & PriorityRelations

export const PriorityWithRelationsSchema: z.ZodType<PriorityWithRelations> = PrioritySchema.merge(z.object({
  organization: z.lazy(() => OrganizationWithRelationsSchema),
  issues: z.lazy(() => IssueWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// PRIORITY OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type PriorityOptionalDefaultsRelations = {
  organization: OrganizationOptionalDefaultsWithRelations;
  issues: IssueOptionalDefaultsWithRelations[];
};

export type PriorityOptionalDefaultsWithRelations = z.infer<typeof PriorityOptionalDefaultsSchema> & PriorityOptionalDefaultsRelations

export const PriorityOptionalDefaultsWithRelationsSchema: z.ZodType<PriorityOptionalDefaultsWithRelations> = PriorityOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationOptionalDefaultsWithRelationsSchema),
  issues: z.lazy(() => IssueOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// PRIORITY PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type PriorityPartialRelations = {
  organization?: OrganizationPartialWithRelations;
  issues?: IssuePartialWithRelations[];
};

export type PriorityPartialWithRelations = z.infer<typeof PriorityPartialSchema> & PriorityPartialRelations

export const PriorityPartialWithRelationsSchema: z.ZodType<PriorityPartialWithRelations> = PriorityPartialSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  issues: z.lazy(() => IssuePartialWithRelationsSchema).array(),
})).partial()

export type PriorityOptionalDefaultsWithPartialRelations = z.infer<typeof PriorityOptionalDefaultsSchema> & PriorityPartialRelations

export const PriorityOptionalDefaultsWithPartialRelationsSchema: z.ZodType<PriorityOptionalDefaultsWithPartialRelations> = PriorityOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  issues: z.lazy(() => IssuePartialWithRelationsSchema).array(),
}).partial())

export type PriorityWithPartialRelations = z.infer<typeof PrioritySchema> & PriorityPartialRelations

export const PriorityWithPartialRelationsSchema: z.ZodType<PriorityWithPartialRelations> = PrioritySchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  issues: z.lazy(() => IssuePartialWithRelationsSchema).array(),
}).partial())

export default PrioritySchema;
