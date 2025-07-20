import { z } from 'zod';
import { IssueWithRelationsSchema, IssuePartialWithRelationsSchema, IssueOptionalDefaultsWithRelationsSchema } from './IssueSchema'
import type { IssueWithRelations, IssuePartialWithRelations, IssueOptionalDefaultsWithRelations } from './IssueSchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'

/////////////////////////////////////////
// UPVOTE SCHEMA
/////////////////////////////////////////

export const UpvoteSchema = z.object({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  issueId: z.string(),
  userId: z.string(),
})

export type Upvote = z.infer<typeof UpvoteSchema>

/////////////////////////////////////////
// UPVOTE PARTIAL SCHEMA
/////////////////////////////////////////

export const UpvotePartialSchema = UpvoteSchema.partial()

export type UpvotePartial = z.infer<typeof UpvotePartialSchema>

/////////////////////////////////////////
// UPVOTE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const UpvoteOptionalDefaultsSchema = UpvoteSchema.merge(z.object({
  id: z.string().cuid().optional(),
  createdAt: z.coerce.date().optional(),
}))

export type UpvoteOptionalDefaults = z.infer<typeof UpvoteOptionalDefaultsSchema>

/////////////////////////////////////////
// UPVOTE RELATION SCHEMA
/////////////////////////////////////////

export type UpvoteRelations = {
  issue: IssueWithRelations;
  user: UserWithRelations;
};

export type UpvoteWithRelations = z.infer<typeof UpvoteSchema> & UpvoteRelations

export const UpvoteWithRelationsSchema: z.ZodType<UpvoteWithRelations> = UpvoteSchema.merge(z.object({
  issue: z.lazy(() => IssueWithRelationsSchema),
  user: z.lazy(() => UserWithRelationsSchema),
}))

/////////////////////////////////////////
// UPVOTE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type UpvoteOptionalDefaultsRelations = {
  issue: IssueOptionalDefaultsWithRelations;
  user: UserOptionalDefaultsWithRelations;
};

export type UpvoteOptionalDefaultsWithRelations = z.infer<typeof UpvoteOptionalDefaultsSchema> & UpvoteOptionalDefaultsRelations

export const UpvoteOptionalDefaultsWithRelationsSchema: z.ZodType<UpvoteOptionalDefaultsWithRelations> = UpvoteOptionalDefaultsSchema.merge(z.object({
  issue: z.lazy(() => IssueOptionalDefaultsWithRelationsSchema),
  user: z.lazy(() => UserOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// UPVOTE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type UpvotePartialRelations = {
  issue?: IssuePartialWithRelations;
  user?: UserPartialWithRelations;
};

export type UpvotePartialWithRelations = z.infer<typeof UpvotePartialSchema> & UpvotePartialRelations

export const UpvotePartialWithRelationsSchema: z.ZodType<UpvotePartialWithRelations> = UpvotePartialSchema.merge(z.object({
  issue: z.lazy(() => IssuePartialWithRelationsSchema),
  user: z.lazy(() => UserPartialWithRelationsSchema),
})).partial()

export type UpvoteOptionalDefaultsWithPartialRelations = z.infer<typeof UpvoteOptionalDefaultsSchema> & UpvotePartialRelations

export const UpvoteOptionalDefaultsWithPartialRelationsSchema: z.ZodType<UpvoteOptionalDefaultsWithPartialRelations> = UpvoteOptionalDefaultsSchema.merge(z.object({
  issue: z.lazy(() => IssuePartialWithRelationsSchema),
  user: z.lazy(() => UserPartialWithRelationsSchema),
}).partial())

export type UpvoteWithPartialRelations = z.infer<typeof UpvoteSchema> & UpvotePartialRelations

export const UpvoteWithPartialRelationsSchema: z.ZodType<UpvoteWithPartialRelations> = UpvoteSchema.merge(z.object({
  issue: z.lazy(() => IssuePartialWithRelationsSchema),
  user: z.lazy(() => UserPartialWithRelationsSchema),
}).partial())

export default UpvoteSchema;
