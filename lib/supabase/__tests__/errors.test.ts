import { describe, it, expect } from "vitest";
import {
  SupabaseError,
  AuthenticationError,
  SessionExpiredError,
  InvalidSessionError,
  MissingOrganizationError,
  InvalidJWTError,
  NetworkError,
  ConfigurationError,
  createAuthenticationError,
  createSessionError,
  createOrganizationError,
  createJWTError,
  createNetworkError,
  createConfigurationError,
  isSupabaseError,
  isAuthenticationError,
  isSessionExpiredError,
  isInvalidSessionError,
  isMissingOrganizationError,
  isInvalidJWTError,
  isNetworkError,
  isConfigurationError,
} from "../errors";

describe("Error Classes", () => {
  describe("SupabaseError", () => {
    it("should create error with type and message", () => {
      const error = new SupabaseError("INVALID_SESSION", "Test error message");

      expect(error.name).toBe("SupabaseError");
      expect(error.type).toBe("INVALID_SESSION");
      expect(error.message).toBe("Test error message");
      expect(error.originalError).toBeUndefined();
    });

    it("should create error with original error", () => {
      const originalError = new Error("Original error");
      const error = new SupabaseError(
        "NETWORK_ERROR",
        "Network failed",
        originalError,
      );

      expect(error.name).toBe("SupabaseError");
      expect(error.type).toBe("NETWORK_ERROR");
      expect(error.message).toBe("Network failed");
      expect(error.originalError).toBe(originalError);
    });

    it("should provide detailed string representation", () => {
      const originalError = new Error("Original error");
      const error = new SupabaseError(
        "INVALID_JWT",
        "JWT validation failed",
        originalError,
      );

      const detailedString = error.toDetailedString();

      expect(detailedString).toContain("INVALID_JWT: JWT validation failed");
      expect(detailedString).toContain("Original: Original error");
      expect(detailedString).toContain("Stack:");
    });

    it("should provide JSON representation", () => {
      const originalError = new Error("Original error");
      const error = new SupabaseError(
        "CONFIGURATION_ERROR",
        "Config missing",
        originalError,
      );

      const json = error.toJSON();

      expect(json).toEqual({
        name: "SupabaseError",
        type: "CONFIGURATION_ERROR",
        message: "Config missing",
        originalError: {
          name: "Error",
          message: "Original error",
        },
        stack: expect.any(String) as string,
      });
    });

    it("should provide JSON representation without original error", () => {
      const error = new SupabaseError("EXPIRED_TOKEN", "Token expired");

      const json = error.toJSON();

      expect(json).toEqual({
        name: "SupabaseError",
        type: "EXPIRED_TOKEN",
        message: "Token expired",
        originalError: undefined,
        stack: expect.any(String) as string,
      });
    });
  });

  describe("Specific Error Classes", () => {
    it("should create AuthenticationError correctly", () => {
      const error = new AuthenticationError("Login failed");

      expect(error.name).toBe("AuthenticationError");
      expect(error.type).toBe("UNAUTHORIZED");
      expect(error.message).toBe("Login failed");
    });

    it("should create SessionExpiredError with default message", () => {
      const error = new SessionExpiredError();

      expect(error.name).toBe("SessionExpiredError");
      expect(error.type).toBe("EXPIRED_TOKEN");
      expect(error.message).toBe("Session has expired");
    });

    it("should create SessionExpiredError with custom message", () => {
      const error = new SessionExpiredError("Custom expiry message");

      expect(error.name).toBe("SessionExpiredError");
      expect(error.type).toBe("EXPIRED_TOKEN");
      expect(error.message).toBe("Custom expiry message");
    });

    it("should create InvalidSessionError correctly", () => {
      const error = new InvalidSessionError("Session malformed");

      expect(error.name).toBe("InvalidSessionError");
      expect(error.type).toBe("INVALID_SESSION");
      expect(error.message).toBe("Session malformed");
    });

    it("should create MissingOrganizationError with default message", () => {
      const error = new MissingOrganizationError();

      expect(error.name).toBe("MissingOrganizationError");
      expect(error.type).toBe("MISSING_ORGANIZATION");
      expect(error.message).toBe("Organization context is missing or invalid");
    });

    it("should create InvalidJWTError correctly", () => {
      const error = new InvalidJWTError("JWT parsing failed");

      expect(error.name).toBe("InvalidJWTError");
      expect(error.type).toBe("INVALID_JWT");
      expect(error.message).toBe("JWT parsing failed");
    });

    it("should create NetworkError correctly", () => {
      const error = new NetworkError("Connection timeout");

      expect(error.name).toBe("NetworkError");
      expect(error.type).toBe("NETWORK_ERROR");
      expect(error.message).toBe("Connection timeout");
    });

    it("should create ConfigurationError correctly", () => {
      const error = new ConfigurationError("Missing env vars");

      expect(error.name).toBe("ConfigurationError");
      expect(error.type).toBe("CONFIGURATION_ERROR");
      expect(error.message).toBe("Missing env vars");
    });
  });
});

describe("Error Factory Functions", () => {
  describe("createAuthenticationError", () => {
    it("should create error with reason", () => {
      const error = createAuthenticationError("Invalid credentials");

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe("Authentication failed: Invalid credentials");
    });

    it("should create error without reason", () => {
      const error = createAuthenticationError();

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe("Authentication failed");
    });

    it("should create error with original error", () => {
      const originalError = new Error("Network timeout");
      const error = createAuthenticationError("Timeout", originalError);

      expect(error.originalError).toBe(originalError);
    });
  });

  describe("createSessionError", () => {
    it("should create error with context and details", () => {
      const error = createSessionError("login", "Missing user ID");

      expect(error).toBeInstanceOf(InvalidSessionError);
      expect(error.message).toBe("Invalid session in login: Missing user ID");
    });

    it("should create error with context only", () => {
      const error = createSessionError("middleware");

      expect(error).toBeInstanceOf(InvalidSessionError);
      expect(error.message).toBe("Invalid session in middleware");
    });
  });

  describe("createOrganizationError", () => {
    it("should create error with context", () => {
      const error = createOrganizationError("JWT parsing");

      expect(error).toBeInstanceOf(MissingOrganizationError);
      expect(error.message).toBe("Organization context missing in JWT parsing");
    });
  });

  describe("createJWTError", () => {
    it("should create error with operation and details", () => {
      const error = createJWTError("token validation", "Invalid signature");

      expect(error).toBeInstanceOf(InvalidJWTError);
      expect(error.message).toBe(
        "JWT error during token validation: Invalid signature",
      );
    });

    it("should create error with operation only", () => {
      const error = createJWTError("parsing");

      expect(error).toBeInstanceOf(InvalidJWTError);
      expect(error.message).toBe("JWT error during parsing");
    });
  });

  describe("createNetworkError", () => {
    it("should create error with operation", () => {
      const error = createNetworkError("API call");

      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toBe("Network error during API call");
    });
  });

  describe("createConfigurationError", () => {
    it("should create error with component and issue", () => {
      const error = createConfigurationError("database", "Missing URL");

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toBe(
        "Configuration error in database: Missing URL",
      );
    });
  });
});

describe("Error Type Guards", () => {
  const supabaseError = new SupabaseError("INVALID_SESSION", "Test");
  const authError = new AuthenticationError("Auth failed");
  const expiredError = new SessionExpiredError();
  const sessionError = new InvalidSessionError("Invalid");
  const orgError = new MissingOrganizationError();
  const jwtError = new InvalidJWTError("JWT invalid");
  const networkError = new NetworkError("Network failed");
  const configError = new ConfigurationError("Config missing");
  const regularError = new Error("Regular error");

  describe("isSupabaseError", () => {
    it("should return true for SupabaseError instances", () => {
      expect(isSupabaseError(supabaseError)).toBe(true);
      expect(isSupabaseError(authError)).toBe(true);
      expect(isSupabaseError(expiredError)).toBe(true);
      expect(isSupabaseError(sessionError)).toBe(true);
      expect(isSupabaseError(orgError)).toBe(true);
      expect(isSupabaseError(jwtError)).toBe(true);
      expect(isSupabaseError(networkError)).toBe(true);
      expect(isSupabaseError(configError)).toBe(true);
    });

    it("should return false for non-SupabaseError instances", () => {
      expect(isSupabaseError(regularError)).toBe(false);
      expect(isSupabaseError("string")).toBe(false);
      expect(isSupabaseError(null)).toBe(false);
      expect(isSupabaseError(undefined)).toBe(false);
    });
  });

  describe("isAuthenticationError", () => {
    it("should return true only for AuthenticationError", () => {
      expect(isAuthenticationError(authError)).toBe(true);
      expect(isAuthenticationError(supabaseError)).toBe(false);
      expect(isAuthenticationError(regularError)).toBe(false);
    });
  });

  describe("isSessionExpiredError", () => {
    it("should return true only for SessionExpiredError", () => {
      expect(isSessionExpiredError(expiredError)).toBe(true);
      expect(isSessionExpiredError(sessionError)).toBe(false);
      expect(isSessionExpiredError(regularError)).toBe(false);
    });
  });

  describe("isInvalidSessionError", () => {
    it("should return true only for InvalidSessionError", () => {
      expect(isInvalidSessionError(sessionError)).toBe(true);
      expect(isInvalidSessionError(expiredError)).toBe(false);
      expect(isInvalidSessionError(regularError)).toBe(false);
    });
  });

  describe("isMissingOrganizationError", () => {
    it("should return true only for MissingOrganizationError", () => {
      expect(isMissingOrganizationError(orgError)).toBe(true);
      expect(isMissingOrganizationError(sessionError)).toBe(false);
      expect(isMissingOrganizationError(regularError)).toBe(false);
    });
  });

  describe("isInvalidJWTError", () => {
    it("should return true only for InvalidJWTError", () => {
      expect(isInvalidJWTError(jwtError)).toBe(true);
      expect(isInvalidJWTError(authError)).toBe(false);
      expect(isInvalidJWTError(regularError)).toBe(false);
    });
  });

  describe("isNetworkError", () => {
    it("should return true only for NetworkError", () => {
      expect(isNetworkError(networkError)).toBe(true);
      expect(isNetworkError(configError)).toBe(false);
      expect(isNetworkError(regularError)).toBe(false);
    });
  });

  describe("isConfigurationError", () => {
    it("should return true only for ConfigurationError", () => {
      expect(isConfigurationError(configError)).toBe(true);
      expect(isConfigurationError(networkError)).toBe(false);
      expect(isConfigurationError(regularError)).toBe(false);
    });
  });
});
