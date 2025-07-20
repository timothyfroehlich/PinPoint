import { z } from 'zod';
import { OrganizationWithRelationsSchema, OrganizationPartialWithRelationsSchema, OrganizationOptionalDefaultsWithRelationsSchema } from './OrganizationSchema'
import type { OrganizationWithRelations, OrganizationPartialWithRelations, OrganizationOptionalDefaultsWithRelations } from './OrganizationSchema'
import { MachineWithRelationsSchema, MachinePartialWithRelationsSchema, MachineOptionalDefaultsWithRelationsSchema } from './MachineSchema'
import type { MachineWithRelations, MachinePartialWithRelations, MachineOptionalDefaultsWithRelations } from './MachineSchema'
import { CollectionWithRelationsSchema, CollectionPartialWithRelationsSchema, CollectionOptionalDefaultsWithRelationsSchema } from './CollectionSchema'
import type { CollectionWithRelations, CollectionPartialWithRelations, CollectionOptionalDefaultsWithRelations } from './CollectionSchema'

/////////////////////////////////////////
// LOCATION SCHEMA
/////////////////////////////////////////

export const LocationSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  organizationId: z.string(),
  street: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  description: z.string().nullable(),
  pinballMapId: z.number().int().nullable(),
  regionId: z.string().nullable(),
  lastSyncAt: z.coerce.date().nullable(),
  syncEnabled: z.boolean(),
})

export type Location = z.infer<typeof LocationSchema>

/////////////////////////////////////////
// LOCATION PARTIAL SCHEMA
/////////////////////////////////////////

export const LocationPartialSchema = LocationSchema.partial()

export type LocationPartial = z.infer<typeof LocationPartialSchema>

/////////////////////////////////////////
// LOCATION OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const LocationOptionalDefaultsSchema = LocationSchema.merge(z.object({
  id: z.string().cuid().optional(),
  syncEnabled: z.boolean().optional(),
}))

export type LocationOptionalDefaults = z.infer<typeof LocationOptionalDefaultsSchema>

/////////////////////////////////////////
// LOCATION RELATION SCHEMA
/////////////////////////////////////////

export type LocationRelations = {
  organization: OrganizationWithRelations;
  machines: MachineWithRelations[];
  collections: CollectionWithRelations[];
};

export type LocationWithRelations = z.infer<typeof LocationSchema> & LocationRelations

export const LocationWithRelationsSchema: z.ZodType<LocationWithRelations> = LocationSchema.merge(z.object({
  organization: z.lazy(() => OrganizationWithRelationsSchema),
  machines: z.lazy(() => MachineWithRelationsSchema).array(),
  collections: z.lazy(() => CollectionWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// LOCATION OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type LocationOptionalDefaultsRelations = {
  organization: OrganizationOptionalDefaultsWithRelations;
  machines: MachineOptionalDefaultsWithRelations[];
  collections: CollectionOptionalDefaultsWithRelations[];
};

export type LocationOptionalDefaultsWithRelations = z.infer<typeof LocationOptionalDefaultsSchema> & LocationOptionalDefaultsRelations

export const LocationOptionalDefaultsWithRelationsSchema: z.ZodType<LocationOptionalDefaultsWithRelations> = LocationOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationOptionalDefaultsWithRelationsSchema),
  machines: z.lazy(() => MachineOptionalDefaultsWithRelationsSchema).array(),
  collections: z.lazy(() => CollectionOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// LOCATION PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type LocationPartialRelations = {
  organization?: OrganizationPartialWithRelations;
  machines?: MachinePartialWithRelations[];
  collections?: CollectionPartialWithRelations[];
};

export type LocationPartialWithRelations = z.infer<typeof LocationPartialSchema> & LocationPartialRelations

export const LocationPartialWithRelationsSchema: z.ZodType<LocationPartialWithRelations> = LocationPartialSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  machines: z.lazy(() => MachinePartialWithRelationsSchema).array(),
  collections: z.lazy(() => CollectionPartialWithRelationsSchema).array(),
})).partial()

export type LocationOptionalDefaultsWithPartialRelations = z.infer<typeof LocationOptionalDefaultsSchema> & LocationPartialRelations

export const LocationOptionalDefaultsWithPartialRelationsSchema: z.ZodType<LocationOptionalDefaultsWithPartialRelations> = LocationOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  machines: z.lazy(() => MachinePartialWithRelationsSchema).array(),
  collections: z.lazy(() => CollectionPartialWithRelationsSchema).array(),
}).partial())

export type LocationWithPartialRelations = z.infer<typeof LocationSchema> & LocationPartialRelations

export const LocationWithPartialRelationsSchema: z.ZodType<LocationWithPartialRelations> = LocationSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  machines: z.lazy(() => MachinePartialWithRelationsSchema).array(),
  collections: z.lazy(() => CollectionPartialWithRelationsSchema).array(),
}).partial())

export default LocationSchema;
