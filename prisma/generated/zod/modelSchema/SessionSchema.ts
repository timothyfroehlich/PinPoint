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

/////////////////////////////////////////
// SESSION SCHEMA
/////////////////////////////////////////

export const SessionSchema = z.object({
  id: z.string().cuid(),
  sessionToken: z.string(),
  userId: z.string(),
  expires: z.coerce.date(),
});

export type Session = z.infer<typeof SessionSchema>;

/////////////////////////////////////////
// SESSION PARTIAL SCHEMA
/////////////////////////////////////////

export const SessionPartialSchema = SessionSchema.partial();

export type SessionPartial = z.infer<typeof SessionPartialSchema>;

/////////////////////////////////////////
// SESSION OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const SessionOptionalDefaultsSchema = SessionSchema.merge(
  z.object({
    id: z.string().cuid().optional(),
  }),
);

export type SessionOptionalDefaults = z.infer<
  typeof SessionOptionalDefaultsSchema
>;

/////////////////////////////////////////
// SESSION RELATION SCHEMA
/////////////////////////////////////////

export type SessionRelations = {
  user: UserWithRelations;
};

export type SessionWithRelations = z.infer<typeof SessionSchema> &
  SessionRelations;

export const SessionWithRelationsSchema: z.ZodType<SessionWithRelations> =
  SessionSchema.merge(
    z.object({
      user: z.lazy(() => UserWithRelationsSchema),
    }),
  );

/////////////////////////////////////////
// SESSION OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type SessionOptionalDefaultsRelations = {
  user: UserOptionalDefaultsWithRelations;
};

export type SessionOptionalDefaultsWithRelations = z.infer<
  typeof SessionOptionalDefaultsSchema
> &
  SessionOptionalDefaultsRelations;

export const SessionOptionalDefaultsWithRelationsSchema: z.ZodType<SessionOptionalDefaultsWithRelations> =
  SessionOptionalDefaultsSchema.merge(
    z.object({
      user: z.lazy(() => UserOptionalDefaultsWithRelationsSchema),
    }),
  );

/////////////////////////////////////////
// SESSION PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type SessionPartialRelations = {
  user?: UserPartialWithRelations;
};

export type SessionPartialWithRelations = z.infer<typeof SessionPartialSchema> &
  SessionPartialRelations;

export const SessionPartialWithRelationsSchema: z.ZodType<SessionPartialWithRelations> =
  SessionPartialSchema.merge(
    z.object({
      user: z.lazy(() => UserPartialWithRelationsSchema),
    }),
  ).partial();

export type SessionOptionalDefaultsWithPartialRelations = z.infer<
  typeof SessionOptionalDefaultsSchema
> &
  SessionPartialRelations;

export const SessionOptionalDefaultsWithPartialRelationsSchema: z.ZodType<SessionOptionalDefaultsWithPartialRelations> =
  SessionOptionalDefaultsSchema.merge(
    z
      .object({
        user: z.lazy(() => UserPartialWithRelationsSchema),
      })
      .partial(),
  );

export type SessionWithPartialRelations = z.infer<typeof SessionSchema> &
  SessionPartialRelations;

export const SessionWithPartialRelationsSchema: z.ZodType<SessionWithPartialRelations> =
  SessionSchema.merge(
    z
      .object({
        user: z.lazy(() => UserPartialWithRelationsSchema),
      })
      .partial(),
  );

export default SessionSchema;
