import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Configuration Validation", () => {
  it("should have default port redirect URLs in config.toml.template", () => {
    // Template uses default port 3000. Worktree-specific ports are
    // substituted by scripts/worktree_setup.py at post-checkout time.
    const configPath = join(process.cwd(), "supabase/config.toml.template");
    const configContent = readFileSync(configPath, "utf-8");

    const redirectMatch = /additional_redirect_urls = \[([\s\S]*?)\]/.exec(
      configContent
    );
    expect(redirectMatch).toBeTruthy();

    const redirectStr = redirectMatch?.[1] ?? "";

    expect(redirectStr).toContain('http://localhost:3000"');
    expect(redirectStr).toContain("http://localhost:3000/*");
    expect(redirectStr).toContain("http://localhost:3000/auth/callback");
  });

  it("should have required environment variables defined in .env.example", () => {
    const envExamplePath = join(process.cwd(), ".env.example");
    const envExampleContent = readFileSync(envExamplePath, "utf-8");

    const requiredVars = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "POSTGRES_URL",
      "PORT",
      "MAILPIT_PORT",
    ];

    for (const varName of requiredVars) {
      expect(envExampleContent).toContain(varName);
    }
  });
});
