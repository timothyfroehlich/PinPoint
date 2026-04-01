import { describe, it, expect } from "vitest";
import { AuthApiError, AuthWeakPasswordError } from "@supabase/supabase-js";
import { extractCaptchaToken, getUserMessageForAuthError } from "./errors";

describe("getUserMessageForAuthError", () => {
  it("returns breach message for weak_password with pwned reason", () => {
    const error = new AuthWeakPasswordError("Password is too weak", 422, [
      "pwned",
    ]);
    const result = getUserMessageForAuthError(error);
    expect(result).not.toBeUndefined();
    expect(result?.message).toContain("data breach");
    expect(result?.code).toBe("WEAK_PASSWORD");
  });

  it("returns strength message for weak_password with length reason", () => {
    const error = new AuthWeakPasswordError("Password is too weak", 422, [
      "length",
    ]);
    const result = getUserMessageForAuthError(error);
    expect(result).not.toBeUndefined();
    expect(result?.message).toContain("too short");
    expect(result?.code).toBe("WEAK_PASSWORD");
  });

  it("returns generic weak message for weak_password without specific reasons", () => {
    const error = new AuthApiError("Password too weak", 422, "weak_password");
    const result = getUserMessageForAuthError(error);
    expect(result).not.toBeUndefined();
    expect(result?.code).toBe("WEAK_PASSWORD");
  });

  it("returns duplicate message for user_already_exists", () => {
    const error = new AuthApiError(
      "User already exists",
      409,
      "user_already_exists"
    );
    const result = getUserMessageForAuthError(error);
    expect(result).toEqual({
      code: "EMAIL_TAKEN",
      message: "This email is already registered.",
    });
  });

  it("returns duplicate message for email_exists", () => {
    const error = new AuthApiError("Email exists", 409, "email_exists");
    const result = getUserMessageForAuthError(error);
    expect(result?.code).toBe("EMAIL_TAKEN");
  });

  it("returns captcha message for captcha_failed", () => {
    const error = new AuthApiError("captcha failed", 400, "captcha_failed");
    const result = getUserMessageForAuthError(error);
    expect(result).toEqual({
      code: "CAPTCHA",
      message: "Verification failed. Please refresh the page and try again.",
    });
  });

  it("returns rate limit message for over_request_rate_limit", () => {
    const error = new AuthApiError(
      "rate limit",
      429,
      "over_request_rate_limit"
    );
    const result = getUserMessageForAuthError(error);
    expect(result?.code).toBe("RATE_LIMIT");
  });

  it("returns email confirmation message for email_not_confirmed", () => {
    const error = new AuthApiError("not confirmed", 403, "email_not_confirmed");
    const result = getUserMessageForAuthError(error);
    expect(result?.code).toBe("EMAIL_NOT_CONFIRMED");
  });

  it("returns same password message for same_password", () => {
    const error = new AuthApiError("same password", 422, "same_password");
    const result = getUserMessageForAuthError(error);
    expect(result?.code).toBe("SAME_PASSWORD");
    expect(result?.message).toContain("different");
  });

  it("returns validation message for validation_failed", () => {
    const error = new AuthApiError("invalid", 400, "validation_failed");
    const result = getUserMessageForAuthError(error);
    expect(result?.code).toBe("VALIDATION");
  });

  it("returns email not authorized message", () => {
    const error = new AuthApiError(
      "not authorized",
      422,
      "email_address_not_authorized"
    );
    const result = getUserMessageForAuthError(error);
    expect(result?.code).toBe("SERVER");
    expect(result?.message).toContain("verification email");
  });

  it("returns signup disabled message for signup_disabled", () => {
    const error = new AuthApiError("disabled", 422, "signup_disabled");
    const result = getUserMessageForAuthError(error);
    expect(result?.code).toBe("SERVER");
    expect(result?.message).toContain("unavailable");
  });

  it("returns signup disabled message for email_provider_disabled", () => {
    const error = new AuthApiError("disabled", 422, "email_provider_disabled");
    const result = getUserMessageForAuthError(error);
    expect(result?.code).toBe("SERVER");
    expect(result?.message).toContain("unavailable");
  });

  it("returns undefined for unknown error codes", () => {
    const error = new AuthApiError(
      "something weird",
      500,
      "unexpected_failure"
    );
    const result = getUserMessageForAuthError(error);
    expect(result).toBeUndefined();
  });

  it("returns undefined when error has no code", () => {
    const error = new AuthApiError("no code", 500, undefined);
    const result = getUserMessageForAuthError(error);
    expect(result).toBeUndefined();
  });
});

describe("extractCaptchaToken", () => {
  it("returns string token from formData", () => {
    const fd = new FormData();
    fd.set("captchaToken", "abc123");
    expect(extractCaptchaToken(fd)).toBe("abc123");
  });

  it("returns undefined when captchaToken is missing", () => {
    const fd = new FormData();
    expect(extractCaptchaToken(fd)).toBeUndefined();
  });

  it("returns undefined when captchaToken is empty string", () => {
    const fd = new FormData();
    fd.set("captchaToken", "");
    expect(extractCaptchaToken(fd)).toBeUndefined();
  });

  it("returns undefined when captchaToken is a File", () => {
    const fd = new FormData();
    fd.set("captchaToken", new File([""], "file.txt"));
    expect(extractCaptchaToken(fd)).toBeUndefined();
  });
});
