import { describe, it, expect } from "vitest";
import { inviteUserSchema } from "~/app/(app)/admin/users/actions";

describe("InviteUser Validation", () => {
  it("should fail validation for very long first name", () => {
    const longName = "a".repeat(101);
    const result = inviteUserSchema.safeParse({
      firstName: longName,
      lastName: "Doe",
      email: "test@example.com",
      role: "member",
      sendInvite: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(
        "must be 100 characters or less"
      );
    }
  });

  it("should fail validation for very long last name", () => {
    const longName = "a".repeat(101);
    const result = inviteUserSchema.safeParse({
      firstName: "John",
      lastName: longName,
      email: "test@example.com",
      role: "member",
      sendInvite: false,
    });
    expect(result.success).toBe(false);
  });

  it("should fail validation for very long email", () => {
    const longEmail = "a".repeat(255) + "@example.com";
    const result = inviteUserSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      email: longEmail,
      role: "member",
      sendInvite: false,
    });
    expect(result.success).toBe(false);
  });

  it("should pass validation for valid inputs", () => {
    const result = inviteUserSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      email: "test@example.com",
      role: "member",
      sendInvite: false,
    });
    expect(result.success).toBe(true);
  });
});
