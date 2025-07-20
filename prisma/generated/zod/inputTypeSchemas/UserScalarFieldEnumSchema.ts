import { z } from "zod";

export const UserScalarFieldEnumSchema = z.enum([
  "id",
  "name",
  "email",
  "emailVerified",
  "image",
  "createdAt",
  "updatedAt",
  "bio",
  "profilePicture",
  "emailNotificationsEnabled",
  "pushNotificationsEnabled",
  "notificationFrequency",
]);

export default UserScalarFieldEnumSchema;
