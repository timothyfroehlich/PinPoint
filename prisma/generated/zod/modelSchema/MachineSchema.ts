import { z } from "zod";
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
  LocationWithRelationsSchema,
  LocationPartialWithRelationsSchema,
  LocationOptionalDefaultsWithRelationsSchema,
} from "./LocationSchema";
import type {
  LocationWithRelations,
  LocationPartialWithRelations,
  LocationOptionalDefaultsWithRelations,
} from "./LocationSchema";
import {
  ModelWithRelationsSchema,
  ModelPartialWithRelationsSchema,
  ModelOptionalDefaultsWithRelationsSchema,
} from "./ModelSchema";
import type {
  ModelWithRelations,
  ModelPartialWithRelations,
  ModelOptionalDefaultsWithRelations,
} from "./ModelSchema";
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
  CollectionWithRelationsSchema,
  CollectionPartialWithRelationsSchema,
  CollectionOptionalDefaultsWithRelationsSchema,
} from "./CollectionSchema";
import type {
  CollectionWithRelations,
  CollectionPartialWithRelations,
  CollectionOptionalDefaultsWithRelations,
} from "./CollectionSchema";

/////////////////////////////////////////
// MACHINE SCHEMA
/////////////////////////////////////////

export const MachineSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  organizationId: z.string(),
  locationId: z.string(),
  modelId: z.string(),
  ownerId: z.string().nullable(),
  ownerNotificationsEnabled: z.boolean(),
  notifyOnNewIssues: z.boolean(),
  notifyOnStatusChanges: z.boolean(),
  notifyOnComments: z.boolean(),
  qrCodeId: z.string().cuid(),
  qrCodeUrl: z.string().nullable(),
  qrCodeGeneratedAt: z.coerce.date().nullable(),
});

export type Machine = z.infer<typeof MachineSchema>;

/////////////////////////////////////////
// MACHINE PARTIAL SCHEMA
/////////////////////////////////////////

export const MachinePartialSchema = MachineSchema.partial();

export type MachinePartial = z.infer<typeof MachinePartialSchema>;

/////////////////////////////////////////
// MACHINE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const MachineOptionalDefaultsSchema = MachineSchema.merge(
  z.object({
    id: z.string().cuid().optional(),
    ownerNotificationsEnabled: z.boolean().optional(),
    notifyOnNewIssues: z.boolean().optional(),
    notifyOnStatusChanges: z.boolean().optional(),
    notifyOnComments: z.boolean().optional(),
    qrCodeId: z.string().cuid().optional(),
  }),
);

export type MachineOptionalDefaults = z.infer<
  typeof MachineOptionalDefaultsSchema
>;

/////////////////////////////////////////
// MACHINE RELATION SCHEMA
/////////////////////////////////////////

export type MachineRelations = {
  organization: OrganizationWithRelations;
  location: LocationWithRelations;
  model: ModelWithRelations;
  owner?: UserWithRelations | null;
  issues: IssueWithRelations[];
  collections: CollectionWithRelations[];
};

export type MachineWithRelations = z.infer<typeof MachineSchema> &
  MachineRelations;

export const MachineWithRelationsSchema: z.ZodType<MachineWithRelations> =
  MachineSchema.merge(
    z.object({
      organization: z.lazy(() => OrganizationWithRelationsSchema),
      location: z.lazy(() => LocationWithRelationsSchema),
      model: z.lazy(() => ModelWithRelationsSchema),
      owner: z.lazy(() => UserWithRelationsSchema).nullable(),
      issues: z.lazy(() => IssueWithRelationsSchema).array(),
      collections: z.lazy(() => CollectionWithRelationsSchema).array(),
    }),
  );

/////////////////////////////////////////
// MACHINE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type MachineOptionalDefaultsRelations = {
  organization: OrganizationOptionalDefaultsWithRelations;
  location: LocationOptionalDefaultsWithRelations;
  model: ModelOptionalDefaultsWithRelations;
  owner?: UserOptionalDefaultsWithRelations | null;
  issues: IssueOptionalDefaultsWithRelations[];
  collections: CollectionOptionalDefaultsWithRelations[];
};

export type MachineOptionalDefaultsWithRelations = z.infer<
  typeof MachineOptionalDefaultsSchema
> &
  MachineOptionalDefaultsRelations;

export const MachineOptionalDefaultsWithRelationsSchema: z.ZodType<MachineOptionalDefaultsWithRelations> =
  MachineOptionalDefaultsSchema.merge(
    z.object({
      organization: z.lazy(
        () => OrganizationOptionalDefaultsWithRelationsSchema,
      ),
      location: z.lazy(() => LocationOptionalDefaultsWithRelationsSchema),
      model: z.lazy(() => ModelOptionalDefaultsWithRelationsSchema),
      owner: z.lazy(() => UserOptionalDefaultsWithRelationsSchema).nullable(),
      issues: z.lazy(() => IssueOptionalDefaultsWithRelationsSchema).array(),
      collections: z
        .lazy(() => CollectionOptionalDefaultsWithRelationsSchema)
        .array(),
    }),
  );

/////////////////////////////////////////
// MACHINE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type MachinePartialRelations = {
  organization?: OrganizationPartialWithRelations;
  location?: LocationPartialWithRelations;
  model?: ModelPartialWithRelations;
  owner?: UserPartialWithRelations | null;
  issues?: IssuePartialWithRelations[];
  collections?: CollectionPartialWithRelations[];
};

export type MachinePartialWithRelations = z.infer<typeof MachinePartialSchema> &
  MachinePartialRelations;

export const MachinePartialWithRelationsSchema: z.ZodType<MachinePartialWithRelations> =
  MachinePartialSchema.merge(
    z.object({
      organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
      location: z.lazy(() => LocationPartialWithRelationsSchema),
      model: z.lazy(() => ModelPartialWithRelationsSchema),
      owner: z.lazy(() => UserPartialWithRelationsSchema).nullable(),
      issues: z.lazy(() => IssuePartialWithRelationsSchema).array(),
      collections: z.lazy(() => CollectionPartialWithRelationsSchema).array(),
    }),
  ).partial();

export type MachineOptionalDefaultsWithPartialRelations = z.infer<
  typeof MachineOptionalDefaultsSchema
> &
  MachinePartialRelations;

export const MachineOptionalDefaultsWithPartialRelationsSchema: z.ZodType<MachineOptionalDefaultsWithPartialRelations> =
  MachineOptionalDefaultsSchema.merge(
    z
      .object({
        organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
        location: z.lazy(() => LocationPartialWithRelationsSchema),
        model: z.lazy(() => ModelPartialWithRelationsSchema),
        owner: z.lazy(() => UserPartialWithRelationsSchema).nullable(),
        issues: z.lazy(() => IssuePartialWithRelationsSchema).array(),
        collections: z.lazy(() => CollectionPartialWithRelationsSchema).array(),
      })
      .partial(),
  );

export type MachineWithPartialRelations = z.infer<typeof MachineSchema> &
  MachinePartialRelations;

export const MachineWithPartialRelationsSchema: z.ZodType<MachineWithPartialRelations> =
  MachineSchema.merge(
    z
      .object({
        organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
        location: z.lazy(() => LocationPartialWithRelationsSchema),
        model: z.lazy(() => ModelPartialWithRelationsSchema),
        owner: z.lazy(() => UserPartialWithRelationsSchema).nullable(),
        issues: z.lazy(() => IssuePartialWithRelationsSchema).array(),
        collections: z.lazy(() => CollectionPartialWithRelationsSchema).array(),
      })
      .partial(),
  );

export default MachineSchema;
