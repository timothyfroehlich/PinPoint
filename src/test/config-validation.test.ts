import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Configuration Validation", () => {
  it("should have consistent ports in actions.ts and config.toml", () => {
    // Read actions.ts to extract allowlist
    const actionsPath = join(process.cwd(), "src/app/(auth)/actions.ts");
    const actionsContent = readFileSync(actionsPath, "utf-8");

    // Extract allowedOrigins array
    const allowlistMatch = /const allowedOrigins = \[([\s\S]*?)\]/.exec(
      actionsContent
    );
    expect(allowlistMatch).toBeTruthy();

    const allowlistStr = allowlistMatch?.[1] ?? "";
    const allowlistPorts = [...allowlistStr.matchAll(/localhost:(\d+)/g)].map(
      (m) => m[1]
    );

    // Read config.toml to extract redirect URLs
    const configPath = join(process.cwd(), "supabase/config.toml");
    const configContent = readFileSync(configPath, "utf-8");

    // Extract additional_redirect_urls array
    const redirectMatch = /additional_redirect_urls = \[([\s\S]*?)\]/.exec(
      configContent
    );
    expect(redirectMatch).toBeTruthy();

    const redirectStr = redirectMatch?.[1] ?? "";
    const redirectPorts = [...redirectStr.matchAll(/localhost:(\d+)/g)].map(
      (m) => m[1]
    );

    // Get unique ports from both sources
    const allowlistUnique = [...new Set(allowlistPorts)].sort();
    const redirectUnique = [...new Set(redirectPorts)].sort();

    // CRITICAL: Both arrays should have the same ports
    expect(allowlistUnique).toEqual(redirectUnique);

    // Verify expected worktree ports are present
    expect(allowlistUnique).toContain("3000"); // main
    expect(allowlistUnique).toContain("3100"); // secondary
    expect(allowlistUnique).toContain("3200"); // review
    expect(allowlistUnique).toContain("3300"); // antigravity
  });

  it("should have all redirect URL variants for each port", () => {
    // Read config.toml
    const configPath = join(process.cwd(), "supabase/config.toml");
    const configContent = readFileSync(configPath, "utf-8");

    const redirectMatch = /additional_redirect_urls = \[([\s\S]*?)\]/.exec(
      configContent
    );
    expect(redirectMatch).toBeTruthy();

    const redirectStr = redirectMatch?.[1] ?? "";

    // For each port, we should have 3 variants:
    // - http://localhost:PORT
    // - http://localhost:PORT/*
    // - http://localhost:PORT/auth/callback

    const expectedPorts = ["3000", "3100", "3200", "3300"];

    for (const port of expectedPorts) {
      expect(redirectStr).toContain(`http://localhost:${port}"`);
      expect(redirectStr).toContain(`http://localhost:${port}/*`);
      expect(redirectStr).toContain(`http://localhost:${port}/auth/callback`);
    }
  });

  it("should have required environment variables defined in .env.example", () => {
    const envExamplePath = join(process.cwd(), ".env.example");
    const envExampleContent = readFileSync(envExamplePath, "utf-8");

    const requiredVars = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "DATABASE_URL",
      "PORT",
      "MAILPIT_PORT",
    ];

    for (const varName of requiredVars) {
      expect(envExampleContent).toContain(varName);
    }
  });
});
