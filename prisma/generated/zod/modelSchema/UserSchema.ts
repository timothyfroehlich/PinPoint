import { z } from "zod";
import { NotificationFrequencySchema } from "../inputTypeSchemas/NotificationFrequencySchema";
import {
  AccountWithRelationsSchema,
  AccountPartialWithRelationsSchema,
  AccountOptionalDefaultsWithRelationsSchema,
} from "./AccountSchema";
import type {
  AccountWithRelations,
  AccountPartialWithRelations,
  AccountOptionalDefaultsWithRelations,
} from "./AccountSchema";
import {
  SessionWithRelationsSchema,
  SessionPartialWithRelationsSchema,
  SessionOptionalDefaultsWithRelationsSchema,
} from "./SessionSchema";
import type {
  SessionWithRelations,
  SessionPartialWithRelations,
  SessionOptionalDefaultsWithRelations,
} from "./SessionSchema";
import {
  MembershipWithRelationsSchema,
  MembershipPartialWithRelationsSchema,
  MembershipOptionalDefaultsWithRelationsSchema,
} from "./MembershipSchema";
import type {
  MembershipWithRelations,
  MembershipPartialWithRelations,
  MembershipOptionalDefaultsWithRelations,
} from "./MembershipSchema";
import {
  MachineWithRelationsSchema,
  MachinePartialWithRelationsSchema,
  MachineOptionalDefaultsWithRelationsSchema,
} from "./MachineSchema";
import type {
  MachineWithRelations,
  MachinePartialWithRelations,
  MachineOptionalDefaultsWithRelations,
} from "./MachineSchema";
import {
  IssueWithRelationsSchema,
  IssuePartialWithRelationsSchema,
  IssueOptionalDefaultsWithRelationsSchema,
} from "./IssueSchema";
import type {
  IssueWithRelations,
  IssuePartialWithRelations,
  IssueOptionalDefaultsWithRelations,
} from "./IssueSchema";
import {
  CommentWithRelationsSchema,
  CommentPartialWithRelationsSchema,
  CommentOptionalDefaultsWithRelationsSchema,
} from "./CommentSchema";
import type {
  CommentWithRelations,
  CommentPartialWithRelations,
  CommentOptionalDefaultsWithRelations,
} from "./CommentSchema";
import {
  UpvoteWithRelationsSchema,
  UpvotePartialWithRelationsSchema,
  UpvoteOptionalDefaultsWithRelationsSchema,
} from "./UpvoteSchema";
import type {
  UpvoteWithRelations,
  UpvotePartialWithRelations,
  UpvoteOptionalDefaultsWithRelations,
} from "./UpvoteSchema";
import {
  IssueHistoryWithRelationsSchema,
  IssueHistoryPartialWithRelationsSchema,
  IssueHistoryOptionalDefaultsWithRelationsSchema,
} from "./IssueHistorySchema";
import type {
  IssueHistoryWithRelations,
  IssueHistoryPartialWithRelations,
  IssueHistoryOptionalDefaultsWithRelations,
} from "./IssueHistorySchema";
import {
  NotificationWithRelationsSchema,
  NotificationPartialWithRelationsSchema,
  NotificationOptionalDefaultsWithRelationsSchema,
} from "./NotificationSchema";
import type {
  NotificationWithRelations,
  NotificationPartialWithRelations,
  NotificationOptionalDefaultsWithRelations,
} from "./NotificationSchema";

/////////////////////////////////////////
// USER SCHEMA
/////////////////////////////////////////

export const UserSchema = z.object({
  notificationFrequency: NotificationFrequencySchema,
  id: z.string().cuid(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  emailVerified: z.coerce.date().nullable(),
  image: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  bio: z.string().nullable(),
  profilePicture: z.string().nullable(),
  emailNotificationsEnabled: z.boolean(),
  pushNotificationsEnabled: z.boolean(),
});

export type User = z.infer<typeof UserSchema>;

/////////////////////////////////////////
// USER PARTIAL SCHEMA
/////////////////////////////////////////

export const UserPartialSchema = UserSchema.partial();

export type UserPartial = z.infer<typeof UserPartialSchema>;

/////////////////////////////////////////
// USER OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const UserOptionalDefaultsSchema = UserSchema.merge(
  z.object({
    notificationFrequency: NotificationFrequencySchema.optional(),
    id: z.string().cuid().optional(),
    createdAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
    emailNotificationsEnabled: z.boolean().optional(),
    pushNotificationsEnabled: z.boolean().optional(),
  }),
);

export type UserOptionalDefaults = z.infer<typeof UserOptionalDefaultsSchema>;

/////////////////////////////////////////
// USER RELATION SCHEMA
/////////////////////////////////////////

export type UserRelations = {
  accounts: AccountWithRelations[];
  sessions: SessionWithRelations[];
  memberships: MembershipWithRelations[];
  ownedMachines: MachineWithRelations[];
  issuesCreated: IssueWithRelations[];
  issuesAssigned: IssueWithRelations[];
  comments: CommentWithRelations[];
  deletedComments: CommentWithRelations[];
  upvotes: UpvoteWithRelations[];
  activityHistory: IssueHistoryWithRelations[];
  notifications: NotificationWithRelations[];
};

export type UserWithRelations = z.infer<typeof UserSchema> & UserRelations;

export const UserWithRelationsSchema: z.ZodType<UserWithRelations> =
  UserSchema.merge(
    z.object({
      accounts: z.lazy(() => AccountWithRelationsSchema).array(),
      sessions: z.lazy(() => SessionWithRelationsSchema).array(),
      memberships: z.lazy(() => MembershipWithRelationsSchema).array(),
      ownedMachines: z.lazy(() => MachineWithRelationsSchema).array(),
      issuesCreated: z.lazy(() => IssueWithRelationsSchema).array(),
      issuesAssigned: z.lazy(() => IssueWithRelationsSchema).array(),
      comments: z.lazy(() => CommentWithRelationsSchema).array(),
      deletedComments: z.lazy(() => CommentWithRelationsSchema).array(),
      upvotes: z.lazy(() => UpvoteWithRelationsSchema).array(),
      activityHistory: z.lazy(() => IssueHistoryWithRelationsSchema).array(),
      notifications: z.lazy(() => NotificationWithRelationsSchema).array(),
    }),
  );

/////////////////////////////////////////
// USER OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type UserOptionalDefaultsRelations = {
  accounts: AccountOptionalDefaultsWithRelations[];
  sessions: SessionOptionalDefaultsWithRelations[];
  memberships: MembershipOptionalDefaultsWithRelations[];
  ownedMachines: MachineOptionalDefaultsWithRelations[];
  issuesCreated: IssueOptionalDefaultsWithRelations[];
  issuesAssigned: IssueOptionalDefaultsWithRelations[];
  comments: CommentOptionalDefaultsWithRelations[];
  deletedComments: CommentOptionalDefaultsWithRelations[];
  upvotes: UpvoteOptionalDefaultsWithRelations[];
  activityHistory: IssueHistoryOptionalDefaultsWithRelations[];
  notifications: NotificationOptionalDefaultsWithRelations[];
};

export type UserOptionalDefaultsWithRelations = z.infer<
  typeof UserOptionalDefaultsSchema
> &
  UserOptionalDefaultsRelations;

export const UserOptionalDefaultsWithRelationsSchema: z.ZodType<UserOptionalDefaultsWithRelations> =
  UserOptionalDefaultsSchema.merge(
    z.object({
      accounts: z
        .lazy(() => AccountOptionalDefaultsWithRelationsSchema)
        .array(),
      sessions: z
        .lazy(() => SessionOptionalDefaultsWithRelationsSchema)
        .array(),
      memberships: z
        .lazy(() => MembershipOptionalDefaultsWithRelationsSchema)
        .array(),
      ownedMachines: z
        .lazy(() => MachineOptionalDefaultsWithRelationsSchema)
        .array(),
      issuesCreated: z
        .lazy(() => IssueOptionalDefaultsWithRelationsSchema)
        .array(),
      issuesAssigned: z
        .lazy(() => IssueOptionalDefaultsWithRelationsSchema)
        .array(),
      comments: z
        .lazy(() => CommentOptionalDefaultsWithRelationsSchema)
        .array(),
      deletedComments: z
        .lazy(() => CommentOptionalDefaultsWithRelationsSchema)
        .array(),
      upvotes: z.lazy(() => UpvoteOptionalDefaultsWithRelationsSchema).array(),
      activityHistory: z
        .lazy(() => IssueHistoryOptionalDefaultsWithRelationsSchema)
        .array(),
      notifications: z
        .lazy(() => NotificationOptionalDefaultsWithRelationsSchema)
        .array(),
    }),
  );

/////////////////////////////////////////
// USER PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type UserPartialRelations = {
  accounts?: AccountPartialWithRelations[];
  sessions?: SessionPartialWithRelations[];
  memberships?: MembershipPartialWithRelations[];
  ownedMachines?: MachinePartialWithRelations[];
  issuesCreated?: IssuePartialWithRelations[];
  issuesAssigned?: IssuePartialWithRelations[];
  comments?: CommentPartialWithRelations[];
  deletedComments?: CommentPartialWithRelations[];
  upvotes?: UpvotePartialWithRelations[];
  activityHistory?: IssueHistoryPartialWithRelations[];
  notifications?: NotificationPartialWithRelations[];
};

export type UserPartialWithRelations = z.infer<typeof UserPartialSchema> &
  UserPartialRelations;

export const UserPartialWithRelationsSchema: z.ZodType<UserPartialWithRelations> =
  UserPartialSchema.merge(
    z.object({
      accounts: z.lazy(() => AccountPartialWithRelationsSchema).array(),
      sessions: z.lazy(() => SessionPartialWithRelationsSchema).array(),
      memberships: z.lazy(() => MembershipPartialWithRelationsSchema).array(),
      ownedMachines: z.lazy(() => MachinePartialWithRelationsSchema).array(),
      issuesCreated: z.lazy(() => IssuePartialWithRelationsSchema).array(),
      issuesAssigned: z.lazy(() => IssuePartialWithRelationsSchema).array(),
      comments: z.lazy(() => CommentPartialWithRelationsSchema).array(),
      deletedComments: z.lazy(() => CommentPartialWithRelationsSchema).array(),
      upvotes: z.lazy(() => UpvotePartialWithRelationsSchema).array(),
      activityHistory: z
        .lazy(() => IssueHistoryPartialWithRelationsSchema)
        .array(),
      notifications: z
        .lazy(() => NotificationPartialWithRelationsSchema)
        .array(),
    }),
  ).partial();

export type UserOptionalDefaultsWithPartialRelations = z.infer<
  typeof UserOptionalDefaultsSchema
> &
  UserPartialRelations;

export const UserOptionalDefaultsWithPartialRelationsSchema: z.ZodType<UserOptionalDefaultsWithPartialRelations> =
  UserOptionalDefaultsSchema.merge(
    z
      .object({
        accounts: z.lazy(() => AccountPartialWithRelationsSchema).array(),
        sessions: z.lazy(() => SessionPartialWithRelationsSchema).array(),
        memberships: z.lazy(() => MembershipPartialWithRelationsSchema).array(),
        ownedMachines: z.lazy(() => MachinePartialWithRelationsSchema).array(),
        issuesCreated: z.lazy(() => IssuePartialWithRelationsSchema).array(),
        issuesAssigned: z.lazy(() => IssuePartialWithRelationsSchema).array(),
        comments: z.lazy(() => CommentPartialWithRelationsSchema).array(),
        deletedComments: z
          .lazy(() => CommentPartialWithRelationsSchema)
          .array(),
        upvotes: z.lazy(() => UpvotePartialWithRelationsSchema).array(),
        activityHistory: z
          .lazy(() => IssueHistoryPartialWithRelationsSchema)
          .array(),
        notifications: z
          .lazy(() => NotificationPartialWithRelationsSchema)
          .array(),
      })
      .partial(),
  );

export type UserWithPartialRelations = z.infer<typeof UserSchema> &
  UserPartialRelations;

export const UserWithPartialRelationsSchema: z.ZodType<UserWithPartialRelations> =
  UserSchema.merge(
    z
      .object({
        accounts: z.lazy(() => AccountPartialWithRelationsSchema).array(),
        sessions: z.lazy(() => SessionPartialWithRelationsSchema).array(),
        memberships: z.lazy(() => MembershipPartialWithRelationsSchema).array(),
        ownedMachines: z.lazy(() => MachinePartialWithRelationsSchema).array(),
        issuesCreated: z.lazy(() => IssuePartialWithRelationsSchema).array(),
        issuesAssigned: z.lazy(() => IssuePartialWithRelationsSchema).array(),
        comments: z.lazy(() => CommentPartialWithRelationsSchema).array(),
        deletedComments: z
          .lazy(() => CommentPartialWithRelationsSchema)
          .array(),
        upvotes: z.lazy(() => UpvotePartialWithRelationsSchema).array(),
        activityHistory: z
          .lazy(() => IssueHistoryPartialWithRelationsSchema)
          .array(),
        notifications: z
          .lazy(() => NotificationPartialWithRelationsSchema)
          .array(),
      })
      .partial(),
  );

export default UserSchema;
