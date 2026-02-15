import { describe, it, expect } from "vitest";
import {
  loginSchema,
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
