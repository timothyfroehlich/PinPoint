import { describe, it, expect } from "vitest";
import { loginSchema, signupSchema } from "~/app/(auth)/schemas";

/**
 * Unit tests for authentication validation schemas
 *
 * Tests the Zod schemas used in login and signup actions.
 * These tests validate input without hitting the database.
 */

describe("loginSchema", () => {
  it("should validate correct email and password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
      expect(result.data.password).toBe("password123");
      expect(result.data.rememberMe).toBeUndefined();
    }
  });

  it("should validate with rememberMe option", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "password123",
      rememberMe: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rememberMe).toBe(true);
    }
  });

  it("should reject invalid email format", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("valid email");
    }
  });

  it("should reject empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Password is required");
    }
  });

  it("should reject missing email", () => {
    const result = loginSchema.safeParse({
      password: "password123",
    });

    expect(result.success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("should validate correct name, email, and password", () => {
    const result = signupSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      password: "SecurePass123",
      confirmPassword: "SecurePass123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe("John");
      expect(result.data.lastName).toBe("Doe");
      expect(result.data.email).toBe("john@example.com");
      expect(result.data.password).toBe("SecurePass123");
    }
  });

  it("should trim whitespace from names", () => {
    const result = signupSchema.safeParse({
      firstName: "  John  ",
      lastName: "  Doe  ",
      email: "john@example.com",
      password: "SecurePass123",
      confirmPassword: "SecurePass123",
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
    });

    expect(result.success).toBe(true);
  });
});
