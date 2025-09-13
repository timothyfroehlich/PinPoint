/**
 * Domain-Org-Mapping Unit Tests - Archetype 1
 * Pure function testing with no external dependencies
 *
 * ARCHETYPE BOUNDARIES:
 * - Test ONLY pure functions that take input and return output
 * - NO database connections, API calls, file system access, or external services
 * - NO React components (use Client Island or Server Component archetypes instead)
 * - NO mocking of dependencies (indicates business logic archetype needed)
 *
 * WHAT BELONGS HERE:
 * - Hostname parsing and subdomain extraction logic
 * - Alias mapping functionality and string normalization
 * - Edge case handling for malformed or empty inputs
 * - Browser environment detection logic
 *
 * WHAT DOESN'T BELONG:
 * - Functions that call databases, APIs, or external services
 * - React components or hooks (these need rendering environments)
 * - Functions requiring authentication context or organization scoping
 * - Business logic that coordinates multiple services or data sources
 *
 * TESTING PATTERNS:
 * - Use arrange-act-assert pattern for clarity
 * - Test edge cases, boundary conditions, and error scenarios
 * - Focus on input/output contracts rather than implementation details
 * - Keep tests fast and deterministic with no async operations
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  ORG_ALIAS_HOSTS,
  resolveOrgSubdomainFromHost,
  resolveOrgSubdomainFromLocation,
} from "~/lib/domain-org-mapping";

describe("Domain-Org-Mapping (Unit Tests - Archetype 1)", () => {
  // Suppress console.log output during tests
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {
      // Intentionally empty to suppress console output during tests
    });
  });

  describe("ORG_ALIAS_HOSTS", () => {
    it("contains expected alias mappings", () => {
      // Arrange & Act
      const aliasHosts = ORG_ALIAS_HOSTS;

      // Assert
      expect(aliasHosts).toBeDefined();
      expect(typeof aliasHosts).toBe("object");
      expect(aliasHosts["pinpoint.austinpinballcollective.org"]).toBe("apc");
    });

    it("is a read-only record type", () => {
      // Arrange
      const keys = Object.keys(ORG_ALIAS_HOSTS);
      const values = Object.values(ORG_ALIAS_HOSTS);

      // Assert
      expect(keys.length).toBeGreaterThan(0);
      expect(values.every((val) => typeof val === "string")).toBe(true);
    });
  });

  describe("resolveOrgSubdomainFromHost", () => {
    describe("alias mapping (highest priority)", () => {
      it("returns mapped subdomain for exact alias match", () => {
        // Arrange
        const host = "pinpoint.austinpinballcollective.org";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBe("apc");
      });

      it("handles case-insensitive alias matching", () => {
        // Arrange
        const host = "PINPOINT.AUSTINPINBALLCOLLECTIVE.ORG";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBe("apc");
      });

      it("strips port numbers from alias matching", () => {
        // Arrange
        const host = "pinpoint.austinpinballcollective.org:8080";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBe("apc");
      });

      it("returns null for hosts that don't match any alias", () => {
        // Arrange - use 2-part domain that won't match multi-label rule
        const host = "unknown.org";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBeNull();
      });
    });

    describe("localhost subdomain format", () => {
      it("extracts subdomain from localhost format", () => {
        // Arrange
        const host = "apc.localhost";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBe("apc");
      });

      it("handles localhost with port number", () => {
        // Arrange
        const host = "apc.localhost:3000";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBe("apc");
      });

      it("handles case-insensitive localhost detection", () => {
        // Arrange
        const host = "ORG.LOCALHOST";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBe("ORG");
      });

      it("returns null for bare localhost", () => {
        // Arrange
        const host = "localhost";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBeNull();
      });

      it("returns null for localhost with port only", () => {
        // Arrange
        const host = "localhost:3000";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBeNull();
      });
    });

    describe("multi-label host format (3+ parts)", () => {
      it("extracts leftmost label from 3-part hostname", () => {
        // Arrange
        const host = "org.example.com";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBe("org");
      });

      it("extracts leftmost label from 4-part hostname", () => {
        // Arrange
        const host = "subdomain.org.example.com";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBe("subdomain");
      });

      it("handles hostname with port number", () => {
        // Arrange
        const host = "org.example.com:8080";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBe("org");
      });

      it("returns null for 2-part hostname (domain.tld)", () => {
        // Arrange
        const host = "example.com";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBeNull();
      });

      it("returns null for 1-part hostname", () => {
        // Arrange
        const host = "localhost";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBeNull();
      });
    });

    describe("edge cases and error conditions", () => {
      it("handles empty string input", () => {
        // Arrange
        const host = "";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBeNull();
      });

      it("handles host with only port", () => {
        // Arrange
        const host = ":3000";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBeNull();
      });

      it("handles host with empty first part", () => {
        // Arrange
        const host = ".example.com";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBe("");
      });

      it("handles host with multiple consecutive dots", () => {
        // Arrange
        const host = "org..example.com";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBe("org");
      });

      it("handles host ending with dot", () => {
        // Arrange
        const host = "org.example.com.";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBe("org");
      });

      it("handles whitespace in hostname", () => {
        // Arrange
        const host = " org.example.com ";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBe(" org");
      });
    });

    describe("priority ordering verification", () => {
      it("alias takes priority over multi-label format", () => {
        // This test verifies that if a hostname matches both an alias AND
        // could be parsed as multi-label, the alias wins
        //
        // Note: Current alias "pinpoint.austinpinballcollective.org" has 3 parts
        // so it would normally return "pinpoint" as subdomain, but alias should win

        // Arrange
        const host = "pinpoint.austinpinballcollective.org";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        expect(result).toBe("apc"); // alias result, not "pinpoint"
      });

      it("localhost format takes priority over multi-label", () => {
        // Arrange - this has 3 parts so could match multi-label rule
        const host = "org.localhost.com";

        // Act
        const result = resolveOrgSubdomainFromHost(host);

        // Assert
        // Should return "org" from multi-label rule, not from localhost rule
        // since "localhost.com" is not exactly "localhost"
        expect(result).toBe("org");
      });
    });
  });

  describe("resolveOrgSubdomainFromLocation", () => {
    let originalWindow: any;

    beforeEach(() => {
      originalWindow = (global as any).window;
    });

    afterEach(() => {
      (global as any).window = originalWindow;
    });

    describe("browser environment detection", () => {
      it("returns null when window is undefined (server environment)", () => {
        // Arrange - ensure window is undefined
        (global as any).window = undefined;

        // Act
        const result = resolveOrgSubdomainFromLocation();

        // Assert
        expect(result).toBeNull();
      });

      it("calls resolveOrgSubdomainFromHost with window.location.hostname", () => {
        // Arrange - mock browser environment
        const mockLocation = {
          hostname: "apc.localhost",
        };

        (global as any).window = { location: mockLocation };

        // Act
        const result = resolveOrgSubdomainFromLocation();

        // Assert
        expect(result).toBe("apc");
      });

      it("handles complex hostname from window.location", () => {
        // Arrange
        const mockLocation = {
          hostname: "org.example.com",
        };

        (global as any).window = { location: mockLocation };

        // Act
        const result = resolveOrgSubdomainFromLocation();

        // Assert
        expect(result).toBe("org");
      });
    });

    describe("integration with host resolution", () => {
      it("applies same alias resolution rules", () => {
        // Arrange
        const mockLocation = {
          hostname: "pinpoint.austinpinballcollective.org",
        };

        (global as any).window = { location: mockLocation };

        // Act
        const result = resolveOrgSubdomainFromLocation();

        // Assert
        expect(result).toBe("apc");
      });
    });
  });
});
