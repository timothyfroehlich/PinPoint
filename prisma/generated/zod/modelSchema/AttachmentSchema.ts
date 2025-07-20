import { z } from "zod";
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

/////////////////////////////////////////
// ATTACHMENT SCHEMA
/////////////////////////////////////////

export const AttachmentSchema = z.object({
  id: z.string().cuid(),
  url: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  createdAt: z.coerce.date(),
  organizationId: z.string(),
  issueId: z.string(),
});

export type Attachment = z.infer<typeof AttachmentSchema>;

/////////////////////////////////////////
// ATTACHMENT PARTIAL SCHEMA
/////////////////////////////////////////

export const AttachmentPartialSchema = AttachmentSchema.partial();

export type AttachmentPartial = z.infer<typeof AttachmentPartialSchema>;

/////////////////////////////////////////
// ATTACHMENT OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const AttachmentOptionalDefaultsSchema = AttachmentSchema.merge(
  z.object({
    id: z.string().cuid().optional(),
    createdAt: z.coerce.date().optional(),
  }),
);

export type AttachmentOptionalDefaults = z.infer<
  typeof AttachmentOptionalDefaultsSchema
>;

/////////////////////////////////////////
// ATTACHMENT RELATION SCHEMA
/////////////////////////////////////////

export type AttachmentRelations = {
  issue: IssueWithRelations;
  organization: OrganizationWithRelations;
};

export type AttachmentWithRelations = z.infer<typeof AttachmentSchema> &
  AttachmentRelations;

export const AttachmentWithRelationsSchema: z.ZodType<AttachmentWithRelations> =
  AttachmentSchema.merge(
    z.object({
      issue: z.lazy(() => IssueWithRelationsSchema),
      organization: z.lazy(() => OrganizationWithRelationsSchema),
    }),
  );

/////////////////////////////////////////
// ATTACHMENT OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type AttachmentOptionalDefaultsRelations = {
  issue: IssueOptionalDefaultsWithRelations;
  organization: OrganizationOptionalDefaultsWithRelations;
};

export type AttachmentOptionalDefaultsWithRelations = z.infer<
  typeof AttachmentOptionalDefaultsSchema
> &
  AttachmentOptionalDefaultsRelations;

export const AttachmentOptionalDefaultsWithRelationsSchema: z.ZodType<AttachmentOptionalDefaultsWithRelations> =
  AttachmentOptionalDefaultsSchema.merge(
    z.object({
      issue: z.lazy(() => IssueOptionalDefaultsWithRelationsSchema),
      organization: z.lazy(
        () => OrganizationOptionalDefaultsWithRelationsSchema,
      ),
    }),
  );

/////////////////////////////////////////
// ATTACHMENT PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type AttachmentPartialRelations = {
  issue?: IssuePartialWithRelations;
  organization?: OrganizationPartialWithRelations;
};

export type AttachmentPartialWithRelations = z.infer<
  typeof AttachmentPartialSchema
> &
  AttachmentPartialRelations;

export const AttachmentPartialWithRelationsSchema: z.ZodType<AttachmentPartialWithRelations> =
  AttachmentPartialSchema.merge(
    z.object({
      issue: z.lazy(() => IssuePartialWithRelationsSchema),
      organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
    }),
  ).partial();

export type AttachmentOptionalDefaultsWithPartialRelations = z.infer<
  typeof AttachmentOptionalDefaultsSchema
> &
  AttachmentPartialRelations;

export const AttachmentOptionalDefaultsWithPartialRelationsSchema: z.ZodType<AttachmentOptionalDefaultsWithPartialRelations> =
  AttachmentOptionalDefaultsSchema.merge(
    z
      .object({
        issue: z.lazy(() => IssuePartialWithRelationsSchema),
        organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
      })
      .partial(),
  );

export type AttachmentWithPartialRelations = z.infer<typeof AttachmentSchema> &
  AttachmentPartialRelations;

export const AttachmentWithPartialRelationsSchema: z.ZodType<AttachmentWithPartialRelations> =
  AttachmentSchema.merge(
    z
      .object({
        issue: z.lazy(() => IssuePartialWithRelationsSchema),
        organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
      })
      .partial(),
  );

export default AttachmentSchema;
