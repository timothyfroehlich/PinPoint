import { z } from "zod";
import { JsonValueSchema } from "../inputTypeSchemas/JsonValueSchema";
import type { JsonValueType } from "../inputTypeSchemas/JsonValueSchema";
import {
  OrganizationWithRelationsSchema,
  OrganizationPartialWithRelationsSchema,
  OrganizationOptionalDefaultsWithRelationsSchema,
} from "./OrganizationSchema";
import type {
  OrganizationWithRelations,
  OrganizationPartialWithRelations,
  OrganizationOptionalDefaultsWithRelations,
} from "./OrganizationSchema";
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
  PriorityWithRelationsSchema,
  PriorityPartialWithRelationsSchema,
  PriorityOptionalDefaultsWithRelationsSchema,
} from "./PrioritySchema";
import type {
  PriorityWithRelations,
  PriorityPartialWithRelations,
  PriorityOptionalDefaultsWithRelations,
} from "./PrioritySchema";
import {
  IssueStatusWithRelationsSchema,
  IssueStatusPartialWithRelationsSchema,
  IssueStatusOptionalDefaultsWithRelationsSchema,
} from "./IssueStatusSchema";
import type {
  IssueStatusWithRelations,
  IssueStatusPartialWithRelations,
  IssueStatusOptionalDefaultsWithRelations,
} from "./IssueStatusSchema";
import {
  UserWithRelationsSchema,
  UserPartialWithRelationsSchema,
  UserOptionalDefaultsWithRelationsSchema,
} from "./UserSchema";
import type {
  UserWithRelations,
  UserPartialWithRelations,
  UserOptionalDefaultsWithRelations,
} from "./UserSchema";
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
  AttachmentWithRelationsSchema,
  AttachmentPartialWithRelationsSchema,
  AttachmentOptionalDefaultsWithRelationsSchema,
} from "./AttachmentSchema";
import type {
  AttachmentWithRelations,
  AttachmentPartialWithRelations,
  AttachmentOptionalDefaultsWithRelations,
} from "./AttachmentSchema";
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
  UpvoteWithRelationsSchema,
  UpvotePartialWithRelationsSchema,
  UpvoteOptionalDefaultsWithRelationsSchema,
} from "./UpvoteSchema";
import type {
  UpvoteWithRelations,
  UpvotePartialWithRelations,
  UpvoteOptionalDefaultsWithRelations,
} from "./UpvoteSchema";

/////////////////////////////////////////
// ISSUE SCHEMA
/////////////////////////////////////////

export const IssueSchema = z.object({
  id: z.string().cuid(),
  title: z.string(),
  description: z.string().nullable(),
  consistency: z.string().nullable(),
  checklist: JsonValueSchema.nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  resolvedAt: z.coerce.date().nullable(),
  organizationId: z.string(),
  machineId: z.string(),
  statusId: z.string(),
  priorityId: z.string(),
  createdById: z.string(),
  assignedToId: z.string().nullable(),
});

export type Issue = z.infer<typeof IssueSchema>;

/////////////////////////////////////////
// ISSUE PARTIAL SCHEMA
/////////////////////////////////////////

export const IssuePartialSchema = IssueSchema.partial();

export type IssuePartial = z.infer<typeof IssuePartialSchema>;

/////////////////////////////////////////
// ISSUE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const IssueOptionalDefaultsSchema = IssueSchema.merge(
  z.object({
    id: z.string().cuid().optional(),
    createdAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
  }),
);

export type IssueOptionalDefaults = z.infer<typeof IssueOptionalDefaultsSchema>;

/////////////////////////////////////////
// ISSUE RELATION SCHEMA
/////////////////////////////////////////

export type IssueRelations = {
  organization: OrganizationWithRelations;
  machine: MachineWithRelations;
  priority: PriorityWithRelations;
  status: IssueStatusWithRelations;
  createdBy: UserWithRelations;
  assignedTo?: UserWithRelations | null;
  comments: CommentWithRelations[];
  attachments: AttachmentWithRelations[];
  history: IssueHistoryWithRelations[];
  upvotes: UpvoteWithRelations[];
};

export type IssueWithRelations = Omit<
  z.infer<typeof IssueSchema>,
  "checklist"
> & {
  checklist?: JsonValueType | null;
} & IssueRelations;

export const IssueWithRelationsSchema: z.ZodType<IssueWithRelations> =
  IssueSchema.merge(
    z.object({
      organization: z.lazy(() => OrganizationWithRelationsSchema),
      machine: z.lazy(() => MachineWithRelationsSchema),
      priority: z.lazy(() => PriorityWithRelationsSchema),
      status: z.lazy(() => IssueStatusWithRelationsSchema),
      createdBy: z.lazy(() => UserWithRelationsSchema),
      assignedTo: z.lazy(() => UserWithRelationsSchema).nullable(),
      comments: z.lazy(() => CommentWithRelationsSchema).array(),
      attachments: z.lazy(() => AttachmentWithRelationsSchema).array(),
      history: z.lazy(() => IssueHistoryWithRelationsSchema).array(),
      upvotes: z.lazy(() => UpvoteWithRelationsSchema).array(),
    }),
  );

/////////////////////////////////////////
// ISSUE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type IssueOptionalDefaultsRelations = {
  organization: OrganizationOptionalDefaultsWithRelations;
  machine: MachineOptionalDefaultsWithRelations;
  priority: PriorityOptionalDefaultsWithRelations;
  status: IssueStatusOptionalDefaultsWithRelations;
  createdBy: UserOptionalDefaultsWithRelations;
  assignedTo?: UserOptionalDefaultsWithRelations | null;
  comments: CommentOptionalDefaultsWithRelations[];
  attachments: AttachmentOptionalDefaultsWithRelations[];
  history: IssueHistoryOptionalDefaultsWithRelations[];
  upvotes: UpvoteOptionalDefaultsWithRelations[];
};

export type IssueOptionalDefaultsWithRelations = Omit<
  z.infer<typeof IssueOptionalDefaultsSchema>,
  "checklist"
> & {
  checklist?: JsonValueType | null;
} & IssueOptionalDefaultsRelations;

export const IssueOptionalDefaultsWithRelationsSchema: z.ZodType<IssueOptionalDefaultsWithRelations> =
  IssueOptionalDefaultsSchema.merge(
    z.object({
      organization: z.lazy(
        () => OrganizationOptionalDefaultsWithRelationsSchema,
      ),
      machine: z.lazy(() => MachineOptionalDefaultsWithRelationsSchema),
      priority: z.lazy(() => PriorityOptionalDefaultsWithRelationsSchema),
      status: z.lazy(() => IssueStatusOptionalDefaultsWithRelationsSchema),
      createdBy: z.lazy(() => UserOptionalDefaultsWithRelationsSchema),
      assignedTo: z
        .lazy(() => UserOptionalDefaultsWithRelationsSchema)
        .nullable(),
      comments: z
        .lazy(() => CommentOptionalDefaultsWithRelationsSchema)
        .array(),
      attachments: z
        .lazy(() => AttachmentOptionalDefaultsWithRelationsSchema)
        .array(),
      history: z
        .lazy(() => IssueHistoryOptionalDefaultsWithRelationsSchema)
        .array(),
      upvotes: z.lazy(() => UpvoteOptionalDefaultsWithRelationsSchema).array(),
    }),
  );

/////////////////////////////////////////
// ISSUE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type IssuePartialRelations = {
  organization?: OrganizationPartialWithRelations;
  machine?: MachinePartialWithRelations;
  priority?: PriorityPartialWithRelations;
  status?: IssueStatusPartialWithRelations;
  createdBy?: UserPartialWithRelations;
  assignedTo?: UserPartialWithRelations | null;
  comments?: CommentPartialWithRelations[];
  attachments?: AttachmentPartialWithRelations[];
  history?: IssueHistoryPartialWithRelations[];
  upvotes?: UpvotePartialWithRelations[];
};

export type IssuePartialWithRelations = Omit<
  z.infer<typeof IssuePartialSchema>,
  "checklist"
> & {
  checklist?: JsonValueType | null;
} & IssuePartialRelations;

export const IssuePartialWithRelationsSchema: z.ZodType<IssuePartialWithRelations> =
  IssuePartialSchema.merge(
    z.object({
      organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
      machine: z.lazy(() => MachinePartialWithRelationsSchema),
      priority: z.lazy(() => PriorityPartialWithRelationsSchema),
      status: z.lazy(() => IssueStatusPartialWithRelationsSchema),
      createdBy: z.lazy(() => UserPartialWithRelationsSchema),
      assignedTo: z.lazy(() => UserPartialWithRelationsSchema).nullable(),
      comments: z.lazy(() => CommentPartialWithRelationsSchema).array(),
      attachments: z.lazy(() => AttachmentPartialWithRelationsSchema).array(),
      history: z.lazy(() => IssueHistoryPartialWithRelationsSchema).array(),
      upvotes: z.lazy(() => UpvotePartialWithRelationsSchema).array(),
    }),
  ).partial();

export type IssueOptionalDefaultsWithPartialRelations = Omit<
  z.infer<typeof IssueOptionalDefaultsSchema>,
  "checklist"
> & {
  checklist?: JsonValueType | null;
} & IssuePartialRelations;

export const IssueOptionalDefaultsWithPartialRelationsSchema: z.ZodType<IssueOptionalDefaultsWithPartialRelations> =
  IssueOptionalDefaultsSchema.merge(
    z
      .object({
        organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
        machine: z.lazy(() => MachinePartialWithRelationsSchema),
        priority: z.lazy(() => PriorityPartialWithRelationsSchema),
        status: z.lazy(() => IssueStatusPartialWithRelationsSchema),
        createdBy: z.lazy(() => UserPartialWithRelationsSchema),
        assignedTo: z.lazy(() => UserPartialWithRelationsSchema).nullable(),
        comments: z.lazy(() => CommentPartialWithRelationsSchema).array(),
        attachments: z.lazy(() => AttachmentPartialWithRelationsSchema).array(),
        history: z.lazy(() => IssueHistoryPartialWithRelationsSchema).array(),
        upvotes: z.lazy(() => UpvotePartialWithRelationsSchema).array(),
      })
      .partial(),
  );

export type IssueWithPartialRelations = Omit<
  z.infer<typeof IssueSchema>,
  "checklist"
> & {
  checklist?: JsonValueType | null;
} & IssuePartialRelations;

export const IssueWithPartialRelationsSchema: z.ZodType<IssueWithPartialRelations> =
  IssueSchema.merge(
    z
      .object({
        organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
        machine: z.lazy(() => MachinePartialWithRelationsSchema),
        priority: z.lazy(() => PriorityPartialWithRelationsSchema),
        status: z.lazy(() => IssueStatusPartialWithRelationsSchema),
        createdBy: z.lazy(() => UserPartialWithRelationsSchema),
        assignedTo: z.lazy(() => UserPartialWithRelationsSchema).nullable(),
        comments: z.lazy(() => CommentPartialWithRelationsSchema).array(),
        attachments: z.lazy(() => AttachmentPartialWithRelationsSchema).array(),
        history: z.lazy(() => IssueHistoryPartialWithRelationsSchema).array(),
        upvotes: z.lazy(() => UpvotePartialWithRelationsSchema).array(),
      })
      .partial(),
  );

export default IssueSchema;
