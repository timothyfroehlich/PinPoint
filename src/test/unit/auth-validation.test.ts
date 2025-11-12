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
      name: "John Doe",
      email: "john@example.com",
      password: "SecurePass123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("John Doe");
      expect(result.data.email).toBe("john@example.com");
      expect(result.data.password).toBe("SecurePass123");
    }
  });

  it("should trim whitespace from name", () => {
    const result = signupSchema.safeParse({
      name: "  John Doe  ",
      email: "john@example.com",
      password: "SecurePass123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("John Doe");
    }
  });

  it("should reject empty name", () => {
    const result = signupSchema.safeParse({
      name: "",
      email: "john@example.com",
      password: "SecurePass123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Name is required");
    }
  });

  it("should reject name longer than 100 characters", () => {
    const result = signupSchema.safeParse({
      name: "a".repeat(101),
      email: "john@example.com",
      password: "SecurePass123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("less than 100");
    }
  });

  it("should reject invalid email format", () => {
    const result = signupSchema.safeParse({
      name: "John Doe",
      email: "invalid-email",
      password: "SecurePass123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("valid email");
    }
  });

  it("should reject password shorter than 8 characters", () => {
    const result = signupSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "short",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("at least 8");
    }
  });

  it("should reject password longer than 128 characters", () => {
    const result = signupSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "a".repeat(129),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("less than 128");
    }
  });

  it("should accept password exactly 8 characters", () => {
    const result = signupSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "12345678",
    });

    expect(result.success).toBe(true);
  });

  it("should accept password exactly 128 characters", () => {
    const result = signupSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "a".repeat(128),
    });

    expect(result.success).toBe(true);
  });
});
