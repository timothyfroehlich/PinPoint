import { describe, it, expect } from "vitest";
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./schemas";

/**
 * Authentication Schema Validation Tests
 *
 * Tests validation logic for password reset flows:
 * - forgotPasswordSchema: Email validation for password reset requests
 * - resetPasswordSchema: Password validation with confirmation matching
 *
 * These schemas are user-facing, so error messages are validated
 * to ensure they provide clear guidance to users.
 */

describe("loginSchema", () => {
  it("should accept valid email with password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "TestPassword123",
    });
    expect(result.success).toBe(true);
  });

  it("should accept plain username (no @) with password", () => {
    const result = loginSchema.safeParse({
      email: "jdoe",
      password: "TestPassword123",
    });
    expect(result.success).toBe(true);
  });

  it("should accept alphanumeric username with underscores", () => {
    const result = loginSchema.safeParse({
      email: "john_doe_42",
      password: "TestPassword123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty email/username", () => {
    const result = loginSchema.safeParse({
      email: "",
      password: "TestPassword123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject single-character username", () => {
    const result = loginSchema.safeParse({
      email: "x",
      password: "TestPassword123",
    });
    expect(result.success).toBe(false);
  });

  it("should accept two-character username", () => {
    const result = loginSchema.safeParse({
      email: "ab",
      password: "TestPassword123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject password-only (no email)", () => {
    const result = loginSchema.safeParse({
      password: "TestPassword123",
    });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("should accept valid standard email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "user@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("should accept email with + sign (gmail aliases)", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "user+test@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("should accept email with subdomain", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "user@mail.example.com",
    });
    expect(result.success).toBe(true);
  });

  it("should reject email without @", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "userexample.com",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("email");
    }
  });

  it("should reject email without domain", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "user@",
    });
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("should accept valid password and matching confirmation", () => {
    const result = resetPasswordSchema.safeParse({
      password: "SecurePass123!",
      confirmPassword: "SecurePass123!",
    });
    expect(result.success).toBe(true);
  });

  it("should accept password at minimum length (8 chars)", () => {
    const result = resetPasswordSchema.safeParse({
      password: "12345678",
      confirmPassword: "12345678",
    });
    expect(result.success).toBe(true);
  });

  it("should reject password below minimum length (7 chars)", () => {
    const result = resetPasswordSchema.safeParse({
      password: "1234567",
      confirmPassword: "1234567",
    });
    expect(result.success).toBe(false);
  });

  it("should reject password mismatch", () => {
    const result = resetPasswordSchema.safeParse({
      password: "SecurePass123!",
      confirmPassword: "DifferentPass123!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("match");
    }
  });

  it("should accept password with unicode characters", () => {
    const result = resetPasswordSchema.safeParse({
      password: "Pāsswörd123!",
      confirmPassword: "Pāsswörd123!",
    });
    expect(result.success).toBe(true);
  });
});

describe("signupSchema", () => {
  it("should validate correct name, email, password, and terms", () => {
    const result = signupSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      password: "SecurePass123",
      confirmPassword: "SecurePass123",
      termsAccepted: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe("John");
      expect(result.data.lastName).toBe("Doe");
      expect(result.data.email).toBe("john@example.com");
      expect(result.data.password).toBe("SecurePass123");
      expect(result.data.termsAccepted).toBe(true);
    }
  });

  it("should trim whitespace from names", () => {
    const result = signupSchema.safeParse({
      firstName: "  John  ",
      lastName: "  Doe  ",
      email: "john@example.com",
      password: "SecurePass123",
      confirmPassword: "SecurePass123",
      termsAccepted: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe("John");
      expect(result.data.lastName).toBe("Doe");
    }
  });

  it("should reject empty names", () => {
    const result = signupSchema.safeParse({
      firstName: "",
      lastName: "",
      email: "john@example.com",
      password: "SecurePass123",
      confirmPassword: "SecurePass123",
      termsAccepted: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "First name is required"
      );
    }
  });

  it("should reject names longer than 50 characters", () => {
    const result = signupSchema.safeParse({
      firstName: "a".repeat(51),
      lastName: "Doe",
      email: "john@example.com",
      password: "SecurePass123",
      confirmPassword: "SecurePass123",
      termsAccepted: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("less than 50");
    }
  });

  it("should reject invalid email format", () => {
    const result = signupSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      email: "invalid-email",
      password: "SecurePass123",
      confirmPassword: "SecurePass123",
      termsAccepted: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("valid email");
    }
  });

  it("should reject password shorter than 8 characters", () => {
    const result = signupSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      password: "short",
      confirmPassword: "short",
      termsAccepted: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("at least 8");
    }
  });

  it("should reject password longer than 128 characters", () => {
    const result = signupSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      password: "a".repeat(129),
      confirmPassword: "a".repeat(129),
      termsAccepted: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("less than 128");
    }
  });

  it("should accept password exactly 8 characters", () => {
    const result = signupSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      password: "12345678",
      confirmPassword: "12345678",
      termsAccepted: true,
    });

    expect(result.success).toBe(true);
  });

  it("should accept password exactly 128 characters", () => {
    const result = signupSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      password: "a".repeat(128),
      confirmPassword: "a".repeat(128),
      termsAccepted: true,
    });

    expect(result.success).toBe(true);
  });

  it("should reject mismatched passwords", () => {
    const result = signupSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      password: "SecurePass123",
      confirmPassword: "DifferentPass456",
      termsAccepted: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "Passwords do not match"
      );
      expect(result.error.issues[0]?.path).toContain("confirmPassword");
    }
  });

  it("should reject confirmPassword exceeding 128 characters", () => {
    const result = signupSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      password: "SecurePass123",
      confirmPassword: "a".repeat(129),
      termsAccepted: true,
    });

    expect(result.success).toBe(false);
    const confirmPasswordError = result.error?.issues.find(
      (i) => i.path.includes("confirmPassword") && i.code === "too_big"
    );
    expect(confirmPasswordError).toBeDefined();
  });

  it("should reject when terms are not accepted", () => {
    const result = signupSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      password: "SecurePass123",
      confirmPassword: "SecurePass123",
      termsAccepted: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const termsError = result.error.issues.find((i) =>
        i.path.includes("termsAccepted")
      );
      expect(termsError?.message).toContain("Terms of Service");
    }
  });

  it("should reject when terms field is missing", () => {
    const result = signupSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      password: "SecurePass123",
      confirmPassword: "SecurePass123",
    });

    expect(result.success).toBe(false);
  });
});
