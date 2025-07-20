import { z } from 'zod';
import { RoleWithRelationsSchema, RolePartialWithRelationsSchema, RoleOptionalDefaultsWithRelationsSchema } from './RoleSchema'
import type { RoleWithRelations, RolePartialWithRelations, RoleOptionalDefaultsWithRelations } from './RoleSchema'

/////////////////////////////////////////
// PERMISSION SCHEMA
/////////////////////////////////////////

export const PermissionSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
})

export type Permission = z.infer<typeof PermissionSchema>

/////////////////////////////////////////
// PERMISSION PARTIAL SCHEMA
/////////////////////////////////////////

export const PermissionPartialSchema = PermissionSchema.partial()

export type PermissionPartial = z.infer<typeof PermissionPartialSchema>

/////////////////////////////////////////
// PERMISSION OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const PermissionOptionalDefaultsSchema = PermissionSchema.merge(z.object({
  id: z.string().cuid().optional(),
}))

export type PermissionOptionalDefaults = z.infer<typeof PermissionOptionalDefaultsSchema>

/////////////////////////////////////////
// PERMISSION RELATION SCHEMA
/////////////////////////////////////////

export type PermissionRelations = {
  roles: RoleWithRelations[];
};

export type PermissionWithRelations = z.infer<typeof PermissionSchema> & PermissionRelations

export const PermissionWithRelationsSchema: z.ZodType<PermissionWithRelations> = PermissionSchema.merge(z.object({
  roles: z.lazy(() => RoleWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// PERMISSION OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type PermissionOptionalDefaultsRelations = {
  roles: RoleOptionalDefaultsWithRelations[];
};

export type PermissionOptionalDefaultsWithRelations = z.infer<typeof PermissionOptionalDefaultsSchema> & PermissionOptionalDefaultsRelations

export const PermissionOptionalDefaultsWithRelationsSchema: z.ZodType<PermissionOptionalDefaultsWithRelations> = PermissionOptionalDefaultsSchema.merge(z.object({
  roles: z.lazy(() => RoleOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// PERMISSION PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type PermissionPartialRelations = {
  roles?: RolePartialWithRelations[];
};

export type PermissionPartialWithRelations = z.infer<typeof PermissionPartialSchema> & PermissionPartialRelations

export const PermissionPartialWithRelationsSchema: z.ZodType<PermissionPartialWithRelations> = PermissionPartialSchema.merge(z.object({
  roles: z.lazy(() => RolePartialWithRelationsSchema).array(),
})).partial()

export type PermissionOptionalDefaultsWithPartialRelations = z.infer<typeof PermissionOptionalDefaultsSchema> & PermissionPartialRelations

export const PermissionOptionalDefaultsWithPartialRelationsSchema: z.ZodType<PermissionOptionalDefaultsWithPartialRelations> = PermissionOptionalDefaultsSchema.merge(z.object({
  roles: z.lazy(() => RolePartialWithRelationsSchema).array(),
}).partial())

export type PermissionWithPartialRelations = z.infer<typeof PermissionSchema> & PermissionPartialRelations

export const PermissionWithPartialRelationsSchema: z.ZodType<PermissionWithPartialRelations> = PermissionSchema.merge(z.object({
  roles: z.lazy(() => RolePartialWithRelationsSchema).array(),
}).partial())

export default PermissionSchema;
