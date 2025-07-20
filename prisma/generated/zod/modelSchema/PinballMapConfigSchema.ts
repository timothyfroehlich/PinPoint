import { z } from 'zod';
import { OrganizationWithRelationsSchema, OrganizationPartialWithRelationsSchema, OrganizationOptionalDefaultsWithRelationsSchema } from './OrganizationSchema'
import type { OrganizationWithRelations, OrganizationPartialWithRelations, OrganizationOptionalDefaultsWithRelations } from './OrganizationSchema'

/////////////////////////////////////////
// PINBALL MAP CONFIG SCHEMA
/////////////////////////////////////////

export const PinballMapConfigSchema = z.object({
  id: z.string().cuid(),
  organizationId: z.string(),
  apiEnabled: z.boolean(),
  apiKey: z.string().nullable(),
  autoSyncEnabled: z.boolean(),
  syncIntervalHours: z.number().int(),
  lastGlobalSync: z.coerce.date().nullable(),
  createMissingModels: z.boolean(),
  updateExistingData: z.boolean(),
})

export type PinballMapConfig = z.infer<typeof PinballMapConfigSchema>

/////////////////////////////////////////
// PINBALL MAP CONFIG PARTIAL SCHEMA
/////////////////////////////////////////

export const PinballMapConfigPartialSchema = PinballMapConfigSchema.partial()

export type PinballMapConfigPartial = z.infer<typeof PinballMapConfigPartialSchema>

/////////////////////////////////////////
// PINBALL MAP CONFIG OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const PinballMapConfigOptionalDefaultsSchema = PinballMapConfigSchema.merge(z.object({
  id: z.string().cuid().optional(),
  apiEnabled: z.boolean().optional(),
  autoSyncEnabled: z.boolean().optional(),
  syncIntervalHours: z.number().int().optional(),
  createMissingModels: z.boolean().optional(),
  updateExistingData: z.boolean().optional(),
}))

export type PinballMapConfigOptionalDefaults = z.infer<typeof PinballMapConfigOptionalDefaultsSchema>

/////////////////////////////////////////
// PINBALL MAP CONFIG RELATION SCHEMA
/////////////////////////////////////////

export type PinballMapConfigRelations = {
  organization: OrganizationWithRelations;
};

export type PinballMapConfigWithRelations = z.infer<typeof PinballMapConfigSchema> & PinballMapConfigRelations

export const PinballMapConfigWithRelationsSchema: z.ZodType<PinballMapConfigWithRelations> = PinballMapConfigSchema.merge(z.object({
  organization: z.lazy(() => OrganizationWithRelationsSchema),
}))

/////////////////////////////////////////
// PINBALL MAP CONFIG OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type PinballMapConfigOptionalDefaultsRelations = {
  organization: OrganizationOptionalDefaultsWithRelations;
};

export type PinballMapConfigOptionalDefaultsWithRelations = z.infer<typeof PinballMapConfigOptionalDefaultsSchema> & PinballMapConfigOptionalDefaultsRelations

export const PinballMapConfigOptionalDefaultsWithRelationsSchema: z.ZodType<PinballMapConfigOptionalDefaultsWithRelations> = PinballMapConfigOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// PINBALL MAP CONFIG PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type PinballMapConfigPartialRelations = {
  organization?: OrganizationPartialWithRelations;
};

export type PinballMapConfigPartialWithRelations = z.infer<typeof PinballMapConfigPartialSchema> & PinballMapConfigPartialRelations

export const PinballMapConfigPartialWithRelationsSchema: z.ZodType<PinballMapConfigPartialWithRelations> = PinballMapConfigPartialSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
})).partial()

export type PinballMapConfigOptionalDefaultsWithPartialRelations = z.infer<typeof PinballMapConfigOptionalDefaultsSchema> & PinballMapConfigPartialRelations

export const PinballMapConfigOptionalDefaultsWithPartialRelationsSchema: z.ZodType<PinballMapConfigOptionalDefaultsWithPartialRelations> = PinballMapConfigOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
}).partial())

export type PinballMapConfigWithPartialRelations = z.infer<typeof PinballMapConfigSchema> & PinballMapConfigPartialRelations

export const PinballMapConfigWithPartialRelationsSchema: z.ZodType<PinballMapConfigWithPartialRelations> = PinballMapConfigSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
}).partial())

export default PinballMapConfigSchema;
