import { z } from "zod";
import { StatusCategorySchema } from "../inputTypeSchemas/StatusCategorySchema";
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
  IssueWithRelationsSchema,
  IssuePartialWithRelationsSchema,
  IssueOptionalDefaultsWithRelationsSchema,
} from "./IssueSchema";
import type {
  IssueWithRelations,
  IssuePartialWithRelations,
  IssueOptionalDefaultsWithRelations,
} from "./IssueSchema";

/////////////////////////////////////////
// ISSUE STATUS SCHEMA
/////////////////////////////////////////

export const IssueStatusSchema = z.object({
  category: StatusCategorySchema,
  id: z.string().cuid(),
  name: z.string(),
  organizationId: z.string(),
  isDefault: z.boolean(),
});

export type IssueStatus = z.infer<typeof IssueStatusSchema>;

/////////////////////////////////////////
// ISSUE STATUS PARTIAL SCHEMA
/////////////////////////////////////////

export const IssueStatusPartialSchema = IssueStatusSchema.partial();

export type IssueStatusPartial = z.infer<typeof IssueStatusPartialSchema>;

/////////////////////////////////////////
// ISSUE STATUS OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const IssueStatusOptionalDefaultsSchema = IssueStatusSchema.merge(
  z.object({
    id: z.string().cuid().optional(),
    isDefault: z.boolean().optional(),
  }),
);

export type IssueStatusOptionalDefaults = z.infer<
  typeof IssueStatusOptionalDefaultsSchema
>;

/////////////////////////////////////////
// ISSUE STATUS RELATION SCHEMA
/////////////////////////////////////////

export type IssueStatusRelations = {
  organization: OrganizationWithRelations;
  issues: IssueWithRelations[];
};

export type IssueStatusWithRelations = z.infer<typeof IssueStatusSchema> &
  IssueStatusRelations;

export const IssueStatusWithRelationsSchema: z.ZodType<IssueStatusWithRelations> =
  IssueStatusSchema.merge(
    z.object({
      organization: z.lazy(() => OrganizationWithRelationsSchema),
      issues: z.lazy(() => IssueWithRelationsSchema).array(),
    }),
  );

/////////////////////////////////////////
// ISSUE STATUS OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type IssueStatusOptionalDefaultsRelations = {
  organization: OrganizationOptionalDefaultsWithRelations;
  issues: IssueOptionalDefaultsWithRelations[];
};

export type IssueStatusOptionalDefaultsWithRelations = z.infer<
  typeof IssueStatusOptionalDefaultsSchema
> &
  IssueStatusOptionalDefaultsRelations;

export const IssueStatusOptionalDefaultsWithRelationsSchema: z.ZodType<IssueStatusOptionalDefaultsWithRelations> =
  IssueStatusOptionalDefaultsSchema.merge(
    z.object({
      organization: z.lazy(
        () => OrganizationOptionalDefaultsWithRelationsSchema,
      ),
      issues: z.lazy(() => IssueOptionalDefaultsWithRelationsSchema).array(),
    }),
  );

/////////////////////////////////////////
// ISSUE STATUS PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type IssueStatusPartialRelations = {
  organization?: OrganizationPartialWithRelations;
  issues?: IssuePartialWithRelations[];
};

export type IssueStatusPartialWithRelations = z.infer<
  typeof IssueStatusPartialSchema
> &
  IssueStatusPartialRelations;

export const IssueStatusPartialWithRelationsSchema: z.ZodType<IssueStatusPartialWithRelations> =
  IssueStatusPartialSchema.merge(
    z.object({
      organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
      issues: z.lazy(() => IssuePartialWithRelationsSchema).array(),
    }),
  ).partial();

export type IssueStatusOptionalDefaultsWithPartialRelations = z.infer<
  typeof IssueStatusOptionalDefaultsSchema
> &
  IssueStatusPartialRelations;

export const IssueStatusOptionalDefaultsWithPartialRelationsSchema: z.ZodType<IssueStatusOptionalDefaultsWithPartialRelations> =
  IssueStatusOptionalDefaultsSchema.merge(
    z
      .object({
        organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
        issues: z.lazy(() => IssuePartialWithRelationsSchema).array(),
      })
      .partial(),
  );

export type IssueStatusWithPartialRelations = z.infer<
  typeof IssueStatusSchema
> &
  IssueStatusPartialRelations;

export const IssueStatusWithPartialRelationsSchema: z.ZodType<IssueStatusWithPartialRelations> =
  IssueStatusSchema.merge(
    z
      .object({
        organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
        issues: z.lazy(() => IssuePartialWithRelationsSchema).array(),
      })
      .partial(),
  );

export default IssueStatusSchema;
