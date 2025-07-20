import { z } from "zod";
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
  RoleWithRelationsSchema,
  RolePartialWithRelationsSchema,
  RoleOptionalDefaultsWithRelationsSchema,
} from "./RoleSchema";
import type {
  RoleWithRelations,
  RolePartialWithRelations,
  RoleOptionalDefaultsWithRelations,
} from "./RoleSchema";

/////////////////////////////////////////
// MEMBERSHIP SCHEMA
/////////////////////////////////////////

export const MembershipSchema = z.object({
  id: z.string().cuid(),
  userId: z.string(),
  organizationId: z.string(),
  roleId: z.string(),
});

export type Membership = z.infer<typeof MembershipSchema>;

/////////////////////////////////////////
// MEMBERSHIP PARTIAL SCHEMA
/////////////////////////////////////////

export const MembershipPartialSchema = MembershipSchema.partial();

export type MembershipPartial = z.infer<typeof MembershipPartialSchema>;

/////////////////////////////////////////
// MEMBERSHIP OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const MembershipOptionalDefaultsSchema = MembershipSchema.merge(
  z.object({
    id: z.string().cuid().optional(),
  }),
);

export type MembershipOptionalDefaults = z.infer<
  typeof MembershipOptionalDefaultsSchema
>;

/////////////////////////////////////////
// MEMBERSHIP RELATION SCHEMA
/////////////////////////////////////////

export type MembershipRelations = {
  user: UserWithRelations;
  organization: OrganizationWithRelations;
  role: RoleWithRelations;
};

export type MembershipWithRelations = z.infer<typeof MembershipSchema> &
  MembershipRelations;

export const MembershipWithRelationsSchema: z.ZodType<MembershipWithRelations> =
  MembershipSchema.merge(
    z.object({
      user: z.lazy(() => UserWithRelationsSchema),
      organization: z.lazy(() => OrganizationWithRelationsSchema),
      role: z.lazy(() => RoleWithRelationsSchema),
    }),
  );

/////////////////////////////////////////
// MEMBERSHIP OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type MembershipOptionalDefaultsRelations = {
  user: UserOptionalDefaultsWithRelations;
  organization: OrganizationOptionalDefaultsWithRelations;
  role: RoleOptionalDefaultsWithRelations;
};

export type MembershipOptionalDefaultsWithRelations = z.infer<
  typeof MembershipOptionalDefaultsSchema
> &
  MembershipOptionalDefaultsRelations;

export const MembershipOptionalDefaultsWithRelationsSchema: z.ZodType<MembershipOptionalDefaultsWithRelations> =
  MembershipOptionalDefaultsSchema.merge(
    z.object({
      user: z.lazy(() => UserOptionalDefaultsWithRelationsSchema),
      organization: z.lazy(
        () => OrganizationOptionalDefaultsWithRelationsSchema,
      ),
      role: z.lazy(() => RoleOptionalDefaultsWithRelationsSchema),
    }),
  );

/////////////////////////////////////////
// MEMBERSHIP PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type MembershipPartialRelations = {
  user?: UserPartialWithRelations;
  organization?: OrganizationPartialWithRelations;
  role?: RolePartialWithRelations;
};

export type MembershipPartialWithRelations = z.infer<
  typeof MembershipPartialSchema
> &
  MembershipPartialRelations;

export const MembershipPartialWithRelationsSchema: z.ZodType<MembershipPartialWithRelations> =
  MembershipPartialSchema.merge(
    z.object({
      user: z.lazy(() => UserPartialWithRelationsSchema),
      organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
      role: z.lazy(() => RolePartialWithRelationsSchema),
    }),
  ).partial();

export type MembershipOptionalDefaultsWithPartialRelations = z.infer<
  typeof MembershipOptionalDefaultsSchema
> &
  MembershipPartialRelations;

export const MembershipOptionalDefaultsWithPartialRelationsSchema: z.ZodType<MembershipOptionalDefaultsWithPartialRelations> =
  MembershipOptionalDefaultsSchema.merge(
    z
      .object({
        user: z.lazy(() => UserPartialWithRelationsSchema),
        organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
        role: z.lazy(() => RolePartialWithRelationsSchema),
      })
      .partial(),
  );

export type MembershipWithPartialRelations = z.infer<typeof MembershipSchema> &
  MembershipPartialRelations;

export const MembershipWithPartialRelationsSchema: z.ZodType<MembershipWithPartialRelations> =
  MembershipSchema.merge(
    z
      .object({
        user: z.lazy(() => UserPartialWithRelationsSchema),
        organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
        role: z.lazy(() => RolePartialWithRelationsSchema),
      })
      .partial(),
  );

export default MembershipSchema;
