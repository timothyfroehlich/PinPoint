import { z } from "zod";
import { ActivityTypeSchema } from "../inputTypeSchemas/ActivityTypeSchema";
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
  UserWithRelationsSchema,
  UserPartialWithRelationsSchema,
  UserOptionalDefaultsWithRelationsSchema,
} from "./UserSchema";
import type {
  UserWithRelations,
  UserPartialWithRelations,
  UserOptionalDefaultsWithRelations,
} from "./UserSchema";

/////////////////////////////////////////
// ISSUE HISTORY SCHEMA
/////////////////////////////////////////

export const IssueHistorySchema = z.object({
  type: ActivityTypeSchema,
  id: z.string().cuid(),
  field: z.string(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  changedAt: z.coerce.date(),
  organizationId: z.string(),
  actorId: z.string().nullable(),
  issueId: z.string(),
});

export type IssueHistory = z.infer<typeof IssueHistorySchema>;

/////////////////////////////////////////
// ISSUE HISTORY PARTIAL SCHEMA
/////////////////////////////////////////

export const IssueHistoryPartialSchema = IssueHistorySchema.partial();

export type IssueHistoryPartial = z.infer<typeof IssueHistoryPartialSchema>;

/////////////////////////////////////////
// ISSUE HISTORY OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const IssueHistoryOptionalDefaultsSchema = IssueHistorySchema.merge(
  z.object({
    id: z.string().cuid().optional(),
    changedAt: z.coerce.date().optional(),
  }),
);

export type IssueHistoryOptionalDefaults = z.infer<
  typeof IssueHistoryOptionalDefaultsSchema
>;

/////////////////////////////////////////
// ISSUE HISTORY RELATION SCHEMA
/////////////////////////////////////////

export type IssueHistoryRelations = {
  issue: IssueWithRelations;
  organization: OrganizationWithRelations;
  actor?: UserWithRelations | null;
};

export type IssueHistoryWithRelations = z.infer<typeof IssueHistorySchema> &
  IssueHistoryRelations;

export const IssueHistoryWithRelationsSchema: z.ZodType<IssueHistoryWithRelations> =
  IssueHistorySchema.merge(
    z.object({
      issue: z.lazy(() => IssueWithRelationsSchema),
      organization: z.lazy(() => OrganizationWithRelationsSchema),
      actor: z.lazy(() => UserWithRelationsSchema).nullable(),
    }),
  );

/////////////////////////////////////////
// ISSUE HISTORY OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type IssueHistoryOptionalDefaultsRelations = {
  issue: IssueOptionalDefaultsWithRelations;
  organization: OrganizationOptionalDefaultsWithRelations;
  actor?: UserOptionalDefaultsWithRelations | null;
};

export type IssueHistoryOptionalDefaultsWithRelations = z.infer<
  typeof IssueHistoryOptionalDefaultsSchema
> &
  IssueHistoryOptionalDefaultsRelations;

export const IssueHistoryOptionalDefaultsWithRelationsSchema: z.ZodType<IssueHistoryOptionalDefaultsWithRelations> =
  IssueHistoryOptionalDefaultsSchema.merge(
    z.object({
      issue: z.lazy(() => IssueOptionalDefaultsWithRelationsSchema),
      organization: z.lazy(
        () => OrganizationOptionalDefaultsWithRelationsSchema,
      ),
      actor: z.lazy(() => UserOptionalDefaultsWithRelationsSchema).nullable(),
    }),
  );

/////////////////////////////////////////
// ISSUE HISTORY PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type IssueHistoryPartialRelations = {
  issue?: IssuePartialWithRelations;
  organization?: OrganizationPartialWithRelations;
  actor?: UserPartialWithRelations | null;
};

export type IssueHistoryPartialWithRelations = z.infer<
  typeof IssueHistoryPartialSchema
> &
  IssueHistoryPartialRelations;

export const IssueHistoryPartialWithRelationsSchema: z.ZodType<IssueHistoryPartialWithRelations> =
  IssueHistoryPartialSchema.merge(
    z.object({
      issue: z.lazy(() => IssuePartialWithRelationsSchema),
      organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
      actor: z.lazy(() => UserPartialWithRelationsSchema).nullable(),
    }),
  ).partial();

export type IssueHistoryOptionalDefaultsWithPartialRelations = z.infer<
  typeof IssueHistoryOptionalDefaultsSchema
> &
  IssueHistoryPartialRelations;

export const IssueHistoryOptionalDefaultsWithPartialRelationsSchema: z.ZodType<IssueHistoryOptionalDefaultsWithPartialRelations> =
  IssueHistoryOptionalDefaultsSchema.merge(
    z
      .object({
        issue: z.lazy(() => IssuePartialWithRelationsSchema),
        organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
        actor: z.lazy(() => UserPartialWithRelationsSchema).nullable(),
      })
      .partial(),
  );

export type IssueHistoryWithPartialRelations = z.infer<
  typeof IssueHistorySchema
> &
  IssueHistoryPartialRelations;

export const IssueHistoryWithPartialRelationsSchema: z.ZodType<IssueHistoryWithPartialRelations> =
  IssueHistorySchema.merge(
    z
      .object({
        issue: z.lazy(() => IssuePartialWithRelationsSchema),
        organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
        actor: z.lazy(() => UserPartialWithRelationsSchema).nullable(),
      })
      .partial(),
  );

export default IssueHistorySchema;
