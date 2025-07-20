import { z } from 'zod';
import { NotificationTypeSchema } from '../inputTypeSchemas/NotificationTypeSchema'
import { NotificationEntitySchema } from '../inputTypeSchemas/NotificationEntitySchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'

/////////////////////////////////////////
// NOTIFICATION SCHEMA
/////////////////////////////////////////

export const NotificationSchema = z.object({
  type: NotificationTypeSchema,
  entityType: NotificationEntitySchema.nullable(),
  id: z.string().cuid(),
  message: z.string(),
  read: z.boolean(),
  createdAt: z.coerce.date(),
  userId: z.string(),
  entityId: z.string().nullable(),
  actionUrl: z.string().nullable(),
})

export type Notification = z.infer<typeof NotificationSchema>

/////////////////////////////////////////
// NOTIFICATION PARTIAL SCHEMA
/////////////////////////////////////////

export const NotificationPartialSchema = NotificationSchema.partial()

export type NotificationPartial = z.infer<typeof NotificationPartialSchema>

/////////////////////////////////////////
// NOTIFICATION OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const NotificationOptionalDefaultsSchema = NotificationSchema.merge(z.object({
  id: z.string().cuid().optional(),
  read: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
}))

export type NotificationOptionalDefaults = z.infer<typeof NotificationOptionalDefaultsSchema>

/////////////////////////////////////////
// NOTIFICATION RELATION SCHEMA
/////////////////////////////////////////

export type NotificationRelations = {
  user: UserWithRelations;
};

export type NotificationWithRelations = z.infer<typeof NotificationSchema> & NotificationRelations

export const NotificationWithRelationsSchema: z.ZodType<NotificationWithRelations> = NotificationSchema.merge(z.object({
  user: z.lazy(() => UserWithRelationsSchema),
}))

/////////////////////////////////////////
// NOTIFICATION OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type NotificationOptionalDefaultsRelations = {
  user: UserOptionalDefaultsWithRelations;
};

export type NotificationOptionalDefaultsWithRelations = z.infer<typeof NotificationOptionalDefaultsSchema> & NotificationOptionalDefaultsRelations

export const NotificationOptionalDefaultsWithRelationsSchema: z.ZodType<NotificationOptionalDefaultsWithRelations> = NotificationOptionalDefaultsSchema.merge(z.object({
  user: z.lazy(() => UserOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// NOTIFICATION PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type NotificationPartialRelations = {
  user?: UserPartialWithRelations;
};

export type NotificationPartialWithRelations = z.infer<typeof NotificationPartialSchema> & NotificationPartialRelations

export const NotificationPartialWithRelationsSchema: z.ZodType<NotificationPartialWithRelations> = NotificationPartialSchema.merge(z.object({
  user: z.lazy(() => UserPartialWithRelationsSchema),
})).partial()

export type NotificationOptionalDefaultsWithPartialRelations = z.infer<typeof NotificationOptionalDefaultsSchema> & NotificationPartialRelations

export const NotificationOptionalDefaultsWithPartialRelationsSchema: z.ZodType<NotificationOptionalDefaultsWithPartialRelations> = NotificationOptionalDefaultsSchema.merge(z.object({
  user: z.lazy(() => UserPartialWithRelationsSchema),
}).partial())

export type NotificationWithPartialRelations = z.infer<typeof NotificationSchema> & NotificationPartialRelations

export const NotificationWithPartialRelationsSchema: z.ZodType<NotificationWithPartialRelations> = NotificationSchema.merge(z.object({
  user: z.lazy(() => UserPartialWithRelationsSchema),
}).partial())

export default NotificationSchema;
