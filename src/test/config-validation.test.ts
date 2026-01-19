import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Configuration Validation", () => {
  it("should have all required ports in config.toml.template", () => {
    // Read config.toml.template to extract redirect URLs
    const configPath = join(process.cwd(), "supabase/config.toml.template");
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

    const redirectUnique = [...new Set(redirectPorts)].sort();

    // Verify expected worktree ports are present in Supabase config
    expect(redirectUnique).toContain("3000"); // main
    expect(redirectUnique).toContain("3100"); // secondary
    expect(redirectUnique).toContain("3200"); // review
    expect(redirectUnique).toContain("3300"); // antigravity
  });

  it("should have all redirect URL variants for each port", () => {
    // Read config.toml.template
    const configPath = join(process.cwd(), "supabase/config.toml.template");
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
