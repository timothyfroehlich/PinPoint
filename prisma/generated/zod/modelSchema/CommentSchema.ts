import { z } from 'zod';
import { IssueWithRelationsSchema, IssuePartialWithRelationsSchema, IssueOptionalDefaultsWithRelationsSchema } from './IssueSchema'
import type { IssueWithRelations, IssuePartialWithRelations, IssueOptionalDefaultsWithRelations } from './IssueSchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'

/////////////////////////////////////////
// COMMENT SCHEMA
/////////////////////////////////////////

export const CommentSchema = z.object({
  id: z.string().cuid(),
  content: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
  deletedBy: z.string().nullable(),
  issueId: z.string(),
  authorId: z.string(),
})

export type Comment = z.infer<typeof CommentSchema>

/////////////////////////////////////////
// COMMENT PARTIAL SCHEMA
/////////////////////////////////////////

export const CommentPartialSchema = CommentSchema.partial()

export type CommentPartial = z.infer<typeof CommentPartialSchema>

/////////////////////////////////////////
// COMMENT OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const CommentOptionalDefaultsSchema = CommentSchema.merge(z.object({
  id: z.string().cuid().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type CommentOptionalDefaults = z.infer<typeof CommentOptionalDefaultsSchema>

/////////////////////////////////////////
// COMMENT RELATION SCHEMA
/////////////////////////////////////////

export type CommentRelations = {
  issue: IssueWithRelations;
  author: UserWithRelations;
  deleter?: UserWithRelations | null;
};

export type CommentWithRelations = z.infer<typeof CommentSchema> & CommentRelations

export const CommentWithRelationsSchema: z.ZodType<CommentWithRelations> = CommentSchema.merge(z.object({
  issue: z.lazy(() => IssueWithRelationsSchema),
  author: z.lazy(() => UserWithRelationsSchema),
  deleter: z.lazy(() => UserWithRelationsSchema).nullable(),
}))

/////////////////////////////////////////
// COMMENT OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type CommentOptionalDefaultsRelations = {
  issue: IssueOptionalDefaultsWithRelations;
  author: UserOptionalDefaultsWithRelations;
  deleter?: UserOptionalDefaultsWithRelations | null;
};

export type CommentOptionalDefaultsWithRelations = z.infer<typeof CommentOptionalDefaultsSchema> & CommentOptionalDefaultsRelations

export const CommentOptionalDefaultsWithRelationsSchema: z.ZodType<CommentOptionalDefaultsWithRelations> = CommentOptionalDefaultsSchema.merge(z.object({
  issue: z.lazy(() => IssueOptionalDefaultsWithRelationsSchema),
  author: z.lazy(() => UserOptionalDefaultsWithRelationsSchema),
  deleter: z.lazy(() => UserOptionalDefaultsWithRelationsSchema).nullable(),
}))

/////////////////////////////////////////
// COMMENT PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type CommentPartialRelations = {
  issue?: IssuePartialWithRelations;
  author?: UserPartialWithRelations;
  deleter?: UserPartialWithRelations | null;
};

export type CommentPartialWithRelations = z.infer<typeof CommentPartialSchema> & CommentPartialRelations

export const CommentPartialWithRelationsSchema: z.ZodType<CommentPartialWithRelations> = CommentPartialSchema.merge(z.object({
  issue: z.lazy(() => IssuePartialWithRelationsSchema),
  author: z.lazy(() => UserPartialWithRelationsSchema),
  deleter: z.lazy(() => UserPartialWithRelationsSchema).nullable(),
})).partial()

export type CommentOptionalDefaultsWithPartialRelations = z.infer<typeof CommentOptionalDefaultsSchema> & CommentPartialRelations

export const CommentOptionalDefaultsWithPartialRelationsSchema: z.ZodType<CommentOptionalDefaultsWithPartialRelations> = CommentOptionalDefaultsSchema.merge(z.object({
  issue: z.lazy(() => IssuePartialWithRelationsSchema),
  author: z.lazy(() => UserPartialWithRelationsSchema),
  deleter: z.lazy(() => UserPartialWithRelationsSchema).nullable(),
}).partial())

export type CommentWithPartialRelations = z.infer<typeof CommentSchema> & CommentPartialRelations

export const CommentWithPartialRelationsSchema: z.ZodType<CommentWithPartialRelations> = CommentSchema.merge(z.object({
  issue: z.lazy(() => IssuePartialWithRelationsSchema),
  author: z.lazy(() => UserPartialWithRelationsSchema),
  deleter: z.lazy(() => UserPartialWithRelationsSchema).nullable(),
}).partial())

export default CommentSchema;
