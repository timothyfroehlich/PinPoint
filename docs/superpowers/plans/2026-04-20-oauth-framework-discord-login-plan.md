# OAuth Framework + Discord Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a generic multi-provider OAuth framework (Discord-first, Google-ready) plus a Connected Accounts settings UI that lets existing email/password users link/unlink Discord, while preserving the invariant that every user must retain ≥1 login method.

**Architecture:** A provider registry (`src/lib/auth/providers.ts`) publishes one plain object per OAuth provider (`{ key, displayName, scopes, iconComponent, isAvailable }`). Login/signup forms and the Connected Accounts section iterate the registry. Three new server actions — `signInWithProviderAction`, `linkProviderAction`, `unlinkProviderAction` — wrap `supabase.auth.signInWithOAuth()`, `linkIdentity()`, and `unlinkIdentity()` respectively. `unlinkProviderAction` refuses when `getUserIdentities()` would drop the user below 1 identity. Supabase `config.toml` gets an `[auth.external.discord]` block and `enable_manual_linking = true`; automatic link-by-verified-email is already default Supabase behavior and does not need a config flag. The OAuth callback route requires **no substantive change** — the existing `exchangeCodeForSession()` handles any provider's code.

**Tech Stack:** Next.js 15 App Router, Server Components + Server Actions (no inline handlers), Supabase SSR (`@supabase/ssr` `createServerClient`), `supabase.auth.signInWithOAuth/linkIdentity/unlinkIdentity/getUserIdentities`, shadcn/ui (`Button`, `Separator`, `Tooltip`), Drizzle ORM (read-only here — no schema changes this PR), Vitest (unit) + PGlite (integration) + Playwright (E2E smoke).

---

## Context summary (read once)

- **Spec**: `docs/superpowers/specs/2026-04-19-discord-integration-design.md` § "PR 2 — OAuth provider framework + Discord linking". Decisions #5–#10 and #22 in the decisions log govern scope.
- **Bead**: `PP-7kq` (in-progress). Parent epic `PP-bsy`. Follow-up bead `PP-cjh` (Google OAuth) depends on this PR.
- **Supabase docs finding (via context7)**: There is **no `enable_linked_identities` flag**. The spec listed it as uncertain — it is not a real config key. The facts are:
  - **Automatic linking by verified email is on by default** and cannot be disabled through `config.toml`. Quote from the current Supabase docs: "To ensure security, Supabase Auth requires all user emails to be unique and prevents automatic linking to accounts with unverified email addresses to avoid pre-account takeover attacks." Discord returns `email_verified` in the `identify email` scope payload, which satisfies the verified-email precondition (matches decision #6 in the spec).
  - **Manual linking** (required for the logged-in user clicking "Connect Discord" in settings) is gated by `enable_manual_linking` in `[auth]`. Our template currently has it set to `false` — this PR flips it to `true`.
  - So the spec's two-flag assumption collapses to a single config change: `enable_manual_linking = true`. Document this inline in Task 2 and in the PR description so the open question is explicitly resolved.
- **Existing OAuth coverage**: The callback route already handles OAuth generically (comment at top mentions "Google, GitHub, etc."). No OAuth provider has ever been wired up end-to-end in the product — this is the first.
- **Existing Google config.toml stub**: `[auth.external.google]` is present with `enabled = false` — copy that shape for Discord.
- **Icon strategy**: Discord's brand logo is not in `lucide-react` (no `Discord` export). Ship a minimal hand-rolled inline SVG component at `src/components/icons/discord-icon.tsx` using Discord's official brand mark path. Google's icon can be added the same way when PR `PP-cjh` lands.
- **Email privacy rule (AGENTS.md #12)**: The Connected Accounts row must display the provider name + generic "Connected"/"Not connected" status only. Do **not** render the Discord email or username. Decision #10 in the spec confirms this.
- **Permissions**: Linking your own identities is not a permissioned operation (it's an authenticated user acting on their own `auth.users` row). No `checkPermission()` call is required for these actions.

## File Structure

Each file has one responsibility. Design bible §15 (iconography) and §5 (page archetypes) apply to the new UI.

### New files

| Path                                                                            | Purpose                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `src/lib/auth/providers.ts`                                                     | Provider registry. Exports `Provider` type, `providers` const record keyed by provider key, `getAvailableProviders()` helper.                                                                                                                             |
| `src/lib/auth/providers.test.ts`                                                | Unit tests for registry shape, `isAvailable()` gating, `getAvailableProviders()`.                                                                                                                                                                         |
| `src/lib/auth/identity-guards.ts`                                               | Pure function `canUnlinkIdentity(identities, providerKey)`: returns `{ ok: true }                                                                                                                                                                         | { ok: false, reason: 'ONLY_IDENTITY' \| 'NOT_LINKED' }`. |
| `src/lib/auth/identity-guards.test.ts`                                          | Unit tests for the guard across four cases (zero / one / two identities, not-linked provider).                                                                                                                                                            |
| `src/components/icons/discord-icon.tsx`                                         | Inline-SVG brand icon. Props: `className`, `size` (default 20). Accessible label "Discord logo".                                                                                                                                                          |
| `src/app/(auth)/oauth-actions.ts`                                               | Three server actions: `signInWithProviderAction`, `linkProviderAction`, `unlinkProviderAction`. Exported `Result` types follow the existing `~/lib/result` pattern.                                                                                       |
| `src/app/(auth)/oauth-actions.test.ts`                                          | Unit tests with mocked `createClient`. Covers the "last identity" refusal path, the success path, and the "provider not available" guard.                                                                                                                 |
| `src/app/(app)/settings/connected-accounts/connected-accounts-section.tsx`      | Server Component. Loads `getUserIdentities()`, renders one `ConnectedAccountRow` per registered provider.                                                                                                                                                 |
| `src/app/(app)/settings/connected-accounts/connected-account-row.tsx`           | Client Component. Renders provider name + icon + connected/disconnected state + link/unlink `<form action>`. Disabled + tooltip when unlink would violate the invariant.                                                                                  |
| `src/app/(app)/settings/connected-accounts/connected-accounts-section.test.tsx` | React Testing Library test: renders both states; verifies unlink button is disabled with tooltip when only one identity.                                                                                                                                  |
| `src/app/(auth)/login/oauth-button-list.tsx`                                    | Client Component. Iterates `getAvailableProviders()` and renders a `<form action={signInWithProviderAction.bind(null, key)}>` per provider.                                                                                                               |
| `src/app/(auth)/login/oauth-button-list.test.tsx`                               | Snapshot + assertion: renders zero providers cleanly; renders Discord when `DISCORD_CLIENT_ID` is set.                                                                                                                                                    |
| `e2e/full/oauth-connected-accounts.spec.ts`                                     | E2E smoke: visits `/settings`, verifies the Connected Accounts section renders with a "Connect Discord" button for an email/password user. (Full OAuth round-trip against the real Discord service is out of scope for CI — we stop at the redirect URL.) |

### Edited files

| Path                                                          | Change                                                                                                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `supabase/config.toml.template`                               | Add `[auth.external.discord]` block (copy Google stub shape). Flip `enable_manual_linking = true`.                                                                                               |
| `.env.example` (or wherever env docs live — verify in Task 0) | Document `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` with comment linking to Discord Developer Portal.                                                                                          |
| `src/app/(auth)/login/login-form.tsx`                         | Insert `<OAuthButtonList />` + a `Separator` with "or" label above the existing email/password form. Keep progressive enhancement — no runtime condition that requires JS.                       |
| `src/app/(auth)/signup/signup-form.tsx`                       | Same injection as login-form, same placement.                                                                                                                                                    |
| `src/app/(app)/settings/page.tsx`                             | Add a new `<ConnectedAccountsSection />` between Profile Settings and Notification Preferences. Wrap in `<Separator />` pairs to match existing rhythm.                                          |
| `src/lib/supabase/server.ts`                                  | **No change** (already correct — `createClient() → auth.getUser()` is enforced at each call site).                                                                                               |
| `src/app/(auth)/auth/callback/route.ts`                       | **No substantive change** (existing `exchangeCodeForSession` handles OAuth identically). Add one comment noting Discord is now an active provider so future readers don't assume it's dead code. |

### File count check

10 new, 5 edited. Within scope. No test fixtures or seed changes.

### Google-readiness (explicit)

After this PR ships, adding Google requires:

1. `src/lib/auth/providers.ts` — add one object (`key: 'google', displayName: 'Google', scopes: 'openid email profile', iconComponent: GoogleIcon, isAvailable: () => !!process.env.GOOGLE_CLIENT_ID`). ~5 LOC.
2. `src/components/icons/google-icon.tsx` — inline SVG. ~15 LOC.
3. `supabase/config.toml.template` — flip the existing `[auth.external.google]` `enabled` to `true`. 1 LOC.
4. `.env.example` — document `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. 2 LOC.

Total: ~25 LOC + one icon file. No form changes, no settings page changes, no new actions.

---

## Task 0: Setup — confirm starting point

**Files:**

- None (discovery only)

- [ ] **Step 1: Confirm current branch and remote state**

Run: `git status && git rev-parse --abbrev-ref HEAD`
Expected: On `plan/pr-2-oauth-discord-login` (planning branch) or `feat/oauth-discord-login` (when the human picks this plan up for execution). If execution has started on a different branch, create `feat/oauth-discord-login` off `origin/main` first.

- [ ] **Step 2: Confirm spec is present on the branch**

Run: `test -f docs/superpowers/specs/2026-04-19-discord-integration-design.md && echo ok`
Expected: `ok`

- [ ] **Step 3: Confirm env docs location**

Run: `ls .env.example .env.local.example 2>/dev/null || echo "check README"`
Expected: One of the example files exists — that is where `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` documentation goes in Task 2. If neither exists, document under a new "Environment Variables" subsection in the project README (stop and ask the user before picking a location unilaterally).

- [ ] **Step 4: Confirm dev server env**

Run: `grep -E "^(DISCORD_|GOOGLE_)" .env.local 2>/dev/null || echo "not set — expected for fresh worktree"`
Expected: Unset on fresh worktrees. For local E2E verification in Task 10, the developer will need real Discord dev creds; document that in the PR description.

---

## Task 1: Provider registry types and shape (TDD)

**Files:**

- Create: `src/lib/auth/providers.ts`
- Test: `src/lib/auth/providers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth/providers.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ComponentType } from "react";

// Import lazily in each test so env mutations take effect
async function loadModule() {
  vi.resetModules();
  return import("./providers");
}

describe("provider registry", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env["DISCORD_CLIENT_ID"];
    delete process.env["DISCORD_CLIENT_SECRET"];
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("exposes a discord provider with the expected shape", async () => {
    const mod = await loadModule();
    const discord = mod.providers.discord;

    expect(discord.key).toBe("discord");
    expect(discord.displayName).toBe("Discord");
    expect(discord.scopes).toBe("identify email");
    expect(typeof discord.iconComponent).toBe("function");
    expect(typeof discord.isAvailable).toBe("function");
  });

  it("discord.isAvailable() is false without DISCORD_CLIENT_ID", async () => {
    const mod = await loadModule();
    expect(mod.providers.discord.isAvailable()).toBe(false);
  });

  it("discord.isAvailable() is true when DISCORD_CLIENT_ID is set", async () => {
    process.env["DISCORD_CLIENT_ID"] = "abc";
    const mod = await loadModule();
    expect(mod.providers.discord.isAvailable()).toBe(true);
  });

  it("getAvailableProviders() omits providers whose isAvailable() is false", async () => {
    const mod = await loadModule();
    expect(mod.getAvailableProviders()).toEqual([]);
  });

  it("getAvailableProviders() includes discord when DISCORD_CLIENT_ID is set", async () => {
    process.env["DISCORD_CLIENT_ID"] = "abc";
    const mod = await loadModule();
    const keys = mod.getAvailableProviders().map((p) => p.key);
    expect(keys).toEqual(["discord"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/auth/providers.test.ts`
Expected: FAIL — "Cannot find module './providers'".

- [ ] **Step 3: Create the registry**

Create `src/lib/auth/providers.ts`:

```ts
import type { ComponentType, SVGProps } from "react";
import { DiscordIcon } from "~/components/icons/discord-icon";

/**
 * OAuth providers supported by the login/signup flow and the Connected
 * Accounts settings section.
 *
 * Each provider is a plain object so adding a new provider (Google, GitHub,
 * etc.) requires only a new entry here + an inline SVG icon component.
 */
export interface Provider {
  /** Stable key — matches Supabase's provider string (`discord`, `google`). */
  readonly key: "discord";
  readonly displayName: string;
  /** Space-separated OAuth scopes passed to `signInWithOAuth`. */
  readonly scopes: string;
  /** Icon component; size/className may be overridden by the caller. */
  readonly iconComponent: ComponentType<SVGProps<SVGSVGElement>>;
  /**
   * Returns true when the provider is usable in the current environment.
   * Typically checks that OAuth credentials are present in env vars.
   *
   * Must be a function (not a boolean) so env mutations in tests and
   * worktree-specific `.env.local` files take effect at call time.
   */
  readonly isAvailable: () => boolean;
}

export const providers = {
  discord: {
    key: "discord",
    displayName: "Discord",
    scopes: "identify email",
    iconComponent: DiscordIcon,
    isAvailable: () => Boolean(process.env["DISCORD_CLIENT_ID"]),
  } satisfies Provider,
} as const;

export type ProviderKey = keyof typeof providers;

export function getAvailableProviders(): readonly Provider[] {
  return Object.values(providers).filter((p) => p.isAvailable());
}

export function getProvider(key: ProviderKey): Provider {
  return providers[key];
}
```

Note: The `key` type widens to a union when Google is added. Intentional — strict typing now pays off later.

- [ ] **Step 4: Create the icon component so the import resolves**

Create `src/components/icons/discord-icon.tsx`:

```tsx
import type { SVGProps } from "react";

/**
 * Discord brand mark — official wordmark path from
 * https://discord.com/branding. Kept as an inline SVG because lucide-react
 * does not ship brand icons.
 */
export function DiscordIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg
      role="img"
      aria-label="Discord logo"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      width={20}
      height={20}
      {...props}
    >
      <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.514 12.514 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.334.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.334.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/auth/providers.test.ts`
Expected: 5 passing.

- [ ] **Step 6: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/providers.ts src/lib/auth/providers.test.ts src/components/icons/discord-icon.tsx
git commit -m "feat(auth): add OAuth provider registry with Discord entry (PP-7kq)"
```

---

## Task 2: Supabase config — enable Discord + manual linking

**Files:**

- Modify: `supabase/config.toml.template`
- Modify: `.env.example` (path confirmed in Task 0)

- [ ] **Step 1: Add Discord provider block**

Open `supabase/config.toml.template`. Locate the existing `[auth.external.google]` block (lines ~121–127). Immediately after it, add:

```toml
# Discord OAuth provider
# Configure in .env.local: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET
[auth.external.discord]
enabled = true
client_id = "env(DISCORD_CLIENT_ID)"
secret = "env(DISCORD_CLIENT_SECRET)"
redirect_uri = ""
```

- [ ] **Step 2: Enable manual linking**

In the same file, change `enable_manual_linking = false` to `enable_manual_linking = true` in the `[auth]` block.

Reason (documented for future readers): required by `supabase.auth.linkIdentity()` which the Connected Accounts UI calls when an email/password user clicks "Connect Discord". Automatic link-by-verified-email is **not** controlled by a flag — it is default Supabase behavior and applies when both provider identities use the same verified email (Decision #7 in the spec).

- [ ] **Step 3: Document env vars**

Open `.env.example` (or whichever file Task 0 identified). Add:

```ini
# Discord OAuth credentials (for "Sign in with Discord" and account linking)
# Obtain from https://discord.com/developers/applications
# When set, Discord OAuth buttons appear on login/signup and in Connected Accounts settings.
# When absent, Discord OAuth is hidden end-to-end.
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
```

- [ ] **Step 4: Regenerate worktree config**

The template is the source of truth. Trigger regeneration by touching the post-checkout hook flow:

Run: `git checkout -- supabase/config.toml 2>/dev/null || true` (just in case a stale generated file is lingering).

Run: `python3 scripts/worktree_setup.py` (or whichever script the post-checkout hook invokes — verify from `scripts/` directory listing).

Expected: `supabase/config.toml` is regenerated with the new Discord block.

- [ ] **Step 5: Verify locally**

Run: `grep -A5 "auth.external.discord" supabase/config.toml`
Expected: Output shows `enabled = true` and the env-var bindings.

Run: `grep "enable_manual_linking" supabase/config.toml`
Expected: `enable_manual_linking = true`.

- [ ] **Step 6: Commit**

```bash
git add supabase/config.toml.template .env.example
git commit -m "chore(supabase): enable Discord OAuth + manual identity linking (PP-7kq)"
```

---

## Task 3: Identity guard — pure function (TDD)

**Files:**

- Create: `src/lib/auth/identity-guards.ts`
- Test: `src/lib/auth/identity-guards.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth/identity-guards.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { UserIdentity } from "@supabase/supabase-js";
import { canUnlinkIdentity } from "./identity-guards";

function identity(provider: string): UserIdentity {
  return {
    identity_id: `id-${provider}`,
    id: `row-${provider}`,
    user_id: "u1",
    identity_data: {},
    provider,
    created_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as UserIdentity;
}

describe("canUnlinkIdentity", () => {
  it("refuses when user has only one identity (that one is being unlinked)", () => {
    const result = canUnlinkIdentity([identity("discord")], "discord");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("ONLY_IDENTITY");
  });

  it("refuses when user has zero identities of the target provider", () => {
    const result = canUnlinkIdentity([identity("email")], "discord");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("NOT_LINKED");
  });

  it("allows when user has two identities", () => {
    const result = canUnlinkIdentity(
      [identity("email"), identity("discord")],
      "discord"
    );
    expect(result.ok).toBe(true);
  });

  it("allows when user has three identities", () => {
    const result = canUnlinkIdentity(
      [identity("email"), identity("discord"), identity("google")],
      "discord"
    );
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/auth/identity-guards.test.ts`
Expected: FAIL — "Cannot find module './identity-guards'".

- [ ] **Step 3: Implement the guard**

Create `src/lib/auth/identity-guards.ts`:

```ts
import type { UserIdentity } from "@supabase/supabase-js";
import type { ProviderKey } from "~/lib/auth/providers";

export type UnlinkCheck =
  | { ok: true; identity: UserIdentity }
  | { ok: false; reason: "ONLY_IDENTITY" | "NOT_LINKED" };

/**
 * Decides whether `providerKey` can safely be unlinked from the current user.
 *
 * Safety invariant (spec decision #8): every user must retain ≥1 identity
 * after an unlink. A user with only a Discord identity cannot unlink Discord;
 * they must first add a password or another OAuth provider.
 *
 * This function is pure so it can be unit-tested without a Supabase client
 * and reused from both the server action and the Server Component that
 * decides whether to render the unlink button as disabled.
 */
export function canUnlinkIdentity(
  identities: readonly UserIdentity[],
  providerKey: ProviderKey
): UnlinkCheck {
  const match = identities.find((i) => i.provider === providerKey);

  if (!match) {
    return { ok: false, reason: "NOT_LINKED" };
  }

  if (identities.length <= 1) {
    return { ok: false, reason: "ONLY_IDENTITY" };
  }

  return { ok: true, identity: match };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/auth/identity-guards.test.ts`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/identity-guards.ts src/lib/auth/identity-guards.test.ts
git commit -m "feat(auth): add canUnlinkIdentity guard enforcing ≥1 identity invariant (PP-7kq)"
```

---

## Task 4: Server actions — signInWithProvider, linkProvider, unlinkProvider (TDD)

**Files:**

- Create: `src/app/(auth)/oauth-actions.ts`
- Test: `src/app/(auth)/oauth-actions.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/(auth)/oauth-actions.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { UserIdentity } from "@supabase/supabase-js";

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

async function loadActions() {
  vi.resetModules();
  return import("./oauth-actions");
}

function identity(provider: string): UserIdentity {
  return {
    identity_id: `id-${provider}`,
    id: `row-${provider}`,
    user_id: "u1",
    identity_data: {},
    provider,
    created_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as UserIdentity;
}

describe("signInWithProviderAction", () => {
  beforeEach(() => {
    process.env["DISCORD_CLIENT_ID"] = "abc";
  });

  it("refuses when provider is not available", async () => {
    delete process.env["DISCORD_CLIENT_ID"];
    const { signInWithProviderAction } = await loadActions();
    const result = await signInWithProviderAction("discord");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("calls supabase.auth.signInWithOAuth and redirects to provider URL", async () => {
    const { createClient } = await import("~/lib/supabase/server");
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://discord.com/oauth2/authorize?..." },
      error: null,
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { signInWithOAuth },
    });

    const { signInWithProviderAction } = await loadActions();
    await expect(signInWithProviderAction("discord")).rejects.toThrow(
      /NEXT_REDIRECT:https:\/\/discord\.com/
    );
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "discord",
      options: expect.objectContaining({ scopes: "identify email" }),
    });
  });
});

describe("unlinkProviderAction", () => {
  beforeEach(() => {
    process.env["DISCORD_CLIENT_ID"] = "abc";
  });

  it("refuses when unlink would leave user with zero identities", async () => {
    const { createClient } = await import("~/lib/supabase/server");
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const getUserIdentities = vi.fn().mockResolvedValue({
      data: { identities: [identity("discord")] },
      error: null,
    });
    const unlinkIdentity = vi.fn();
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser, getUserIdentities, unlinkIdentity },
    });

    const { unlinkProviderAction } = await loadActions();
    const result = await unlinkProviderAction("discord");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ONLY_IDENTITY");
    expect(unlinkIdentity).not.toHaveBeenCalled();
  });

  it("unlinks when user has ≥2 identities", async () => {
    const { createClient } = await import("~/lib/supabase/server");
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const discordIdentity = identity("discord");
    const getUserIdentities = vi.fn().mockResolvedValue({
      data: { identities: [identity("email"), discordIdentity] },
      error: null,
    });
    const unlinkIdentity = vi.fn().mockResolvedValue({ error: null });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser, getUserIdentities, unlinkIdentity },
    });

    const { unlinkProviderAction } = await loadActions();
    const result = await unlinkProviderAction("discord");
    expect(result.ok).toBe(true);
    expect(unlinkIdentity).toHaveBeenCalledWith(discordIdentity);
  });

  it("refuses when user is not logged in", async () => {
    const { createClient } = await import("~/lib/supabase/server");
    const getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser },
    });

    const { unlinkProviderAction } = await loadActions();
    const result = await unlinkProviderAction("discord");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_AUTHENTICATED");
  });
});

describe("linkProviderAction", () => {
  beforeEach(() => {
    process.env["DISCORD_CLIENT_ID"] = "abc";
  });

  it("calls linkIdentity and redirects to provider URL", async () => {
    const { createClient } = await import("~/lib/supabase/server");
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const linkIdentity = vi.fn().mockResolvedValue({
      data: { url: "https://discord.com/oauth2/authorize?link=1" },
      error: null,
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser, linkIdentity },
    });

    const { linkProviderAction } = await loadActions();
    await expect(linkProviderAction("discord")).rejects.toThrow(
      /NEXT_REDIRECT:https:\/\/discord\.com/
    );
    expect(linkIdentity).toHaveBeenCalledWith({
      provider: "discord",
      options: expect.objectContaining({ scopes: "identify email" }),
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/app/\(auth\)/oauth-actions.test.ts`
Expected: FAIL — "Cannot find module './oauth-actions'".

- [ ] **Step 3: Implement the actions**

Create `src/app/(auth)/oauth-actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { type Result, ok, err } from "~/lib/result";
import { getSiteUrl } from "~/lib/url";
import { log } from "~/lib/logger";
import { getProvider, providers, type ProviderKey } from "~/lib/auth/providers";
import { canUnlinkIdentity } from "~/lib/auth/identity-guards";

export type SignInWithProviderResult = Result<
  void,
  "PROVIDER_UNAVAILABLE" | "SERVER"
>;

export type LinkProviderResult = Result<
  void,
  "PROVIDER_UNAVAILABLE" | "NOT_AUTHENTICATED" | "SERVER"
>;

export type UnlinkProviderResult = Result<
  void,
  "NOT_AUTHENTICATED" | "ONLY_IDENTITY" | "NOT_LINKED" | "SERVER"
>;

function isProviderKey(value: string): value is ProviderKey {
  return value in providers;
}

/**
 * Initiates OAuth sign-in for a provider (anonymous → authenticated).
 *
 * Wraps `supabase.auth.signInWithOAuth`. Supabase returns a redirect URL;
 * this action throws a Next.js redirect to that URL. The provider redirects
 * back to `/auth/callback?code=...` which the existing callback route handles.
 *
 * Called from the login and signup forms.
 */
export async function signInWithProviderAction(
  rawKey: string
): Promise<SignInWithProviderResult> {
  if (!isProviderKey(rawKey)) {
    return err("PROVIDER_UNAVAILABLE", "Unknown provider");
  }
  const provider = getProvider(rawKey);

  if (!provider.isAvailable()) {
    log.warn(
      { providerKey: rawKey, action: "oauth-sign-in" },
      "Sign-in attempted for unavailable provider"
    );
    return err("PROVIDER_UNAVAILABLE", "This login method is not configured");
  }

  const supabase = await createClient();
  const siteUrl = getSiteUrl();
  const redirectTo = `${siteUrl}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider.key,
    options: {
      scopes: provider.scopes,
      redirectTo,
    },
  });

  if (error || !data?.url) {
    log.error(
      { providerKey: rawKey, error: error?.message, action: "oauth-sign-in" },
      "signInWithOAuth failed"
    );
    return err("SERVER", "Unable to start OAuth sign-in");
  }

  redirect(data.url);
}

/**
 * Adds a provider identity to the currently logged-in user.
 *
 * Wraps `supabase.auth.linkIdentity()`. Requires
 * `enable_manual_linking = true` in `supabase/config.toml.template`.
 *
 * Called from Connected Accounts settings section.
 */
export async function linkProviderAction(
  rawKey: string
): Promise<LinkProviderResult> {
  if (!isProviderKey(rawKey)) {
    return err("PROVIDER_UNAVAILABLE", "Unknown provider");
  }
  const provider = getProvider(rawKey);

  if (!provider.isAvailable()) {
    return err("PROVIDER_UNAVAILABLE", "This provider is not configured");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("NOT_AUTHENTICATED", "You must be signed in to link accounts");
  }

  const siteUrl = getSiteUrl();
  const redirectTo = `${siteUrl}/settings`;

  const { data, error } = await supabase.auth.linkIdentity({
    provider: provider.key,
    options: {
      scopes: provider.scopes,
      redirectTo,
    },
  });

  if (error || !data?.url) {
    log.error(
      {
        userId: user.id,
        providerKey: rawKey,
        error: error?.message,
        action: "oauth-link",
      },
      "linkIdentity failed"
    );
    return err("SERVER", "Unable to start account linking");
  }

  redirect(data.url);
}

/**
 * Removes a provider identity from the current user.
 *
 * Enforces the invariant that a user always retains ≥1 identity
 * (otherwise they lose all login methods and are locked out).
 *
 * Called from Connected Accounts settings section.
 */
export async function unlinkProviderAction(
  rawKey: string
): Promise<UnlinkProviderResult> {
  if (!isProviderKey(rawKey)) {
    return err("NOT_LINKED", "Unknown provider");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("NOT_AUTHENTICATED", "You must be signed in");
  }

  const { data: identitiesData, error: identitiesError } =
    await supabase.auth.getUserIdentities();

  if (identitiesError || !identitiesData) {
    log.error(
      {
        userId: user.id,
        error: identitiesError?.message,
        action: "oauth-unlink",
      },
      "getUserIdentities failed"
    );
    return err("SERVER", "Unable to load your linked accounts");
  }

  const check = canUnlinkIdentity(identitiesData.identities, rawKey);

  if (!check.ok) {
    if (check.reason === "ONLY_IDENTITY") {
      return err(
        "ONLY_IDENTITY",
        "Add a password or another provider before disconnecting this one"
      );
    }
    return err("NOT_LINKED", "This provider is not linked to your account");
  }

  const { error: unlinkError } = await supabase.auth.unlinkIdentity(
    check.identity
  );

  if (unlinkError) {
    log.error(
      {
        userId: user.id,
        providerKey: rawKey,
        error: unlinkError.message,
        action: "oauth-unlink",
      },
      "unlinkIdentity failed"
    );
    return err("SERVER", "Unable to disconnect this provider");
  }

  log.info(
    { userId: user.id, providerKey: rawKey, action: "oauth-unlink" },
    "Provider unlinked successfully"
  );

  return ok(undefined);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/app/\(auth\)/oauth-actions.test.ts`
Expected: 6 passing.

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors. If the `getUserIdentities` response type from `@supabase/supabase-js` is stricter than the test mock, tighten the mock; do not loosen the action.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(auth\)/oauth-actions.ts src/app/\(auth\)/oauth-actions.test.ts
git commit -m "feat(auth): add signIn/link/unlink provider server actions (PP-7kq)"
```

---

## Task 5: OAuth button list on login/signup forms (TDD)

**Files:**

- Create: `src/app/(auth)/login/oauth-button-list.tsx`
- Test: `src/app/(auth)/login/oauth-button-list.test.tsx`
- Modify: `src/app/(auth)/login/login-form.tsx`
- Modify: `src/app/(auth)/signup/signup-form.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/app/(auth)/login/oauth-button-list.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock the providers module so tests control availability
vi.mock("~/lib/auth/providers", async (importActual) => {
  const actual = await importActual<typeof import("~/lib/auth/providers")>();
  return actual;
});

import { OAuthButtonList } from "./oauth-button-list";

describe("OAuthButtonList", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env["DISCORD_CLIENT_ID"];
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("renders nothing when no providers are configured", () => {
    const { container } = render(<OAuthButtonList mode="login" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders Continue with Discord when DISCORD_CLIENT_ID is set", () => {
    process.env["DISCORD_CLIENT_ID"] = "abc";
    render(<OAuthButtonList mode="login" />);
    expect(
      screen.getByRole("button", { name: /continue with discord/i })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/\(auth\)/login/oauth-button-list.test.tsx`
Expected: FAIL — "Cannot find module './oauth-button-list'".

- [ ] **Step 3: Create the component**

Create `src/app/(auth)/login/oauth-button-list.tsx`:

```tsx
import type React from "react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { getAvailableProviders } from "~/lib/auth/providers";
import { signInWithProviderAction } from "~/app/(auth)/oauth-actions";

interface OAuthButtonListProps {
  mode: "login" | "signup";
}

/**
 * Renders one progressive-enhancement <form action> per available provider.
 *
 * Iterates the provider registry at render time (Server Component) so env
 * changes don't require a rebuild in development. The wrapping <form> is
 * how we keep this JS-free — no onClick handler.
 *
 * When no providers are configured, renders nothing (no stray separator).
 */
export function OAuthButtonList({
  mode: _mode,
}: OAuthButtonListProps): React.JSX.Element | null {
  const available = getAvailableProviders();

  if (available.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {available.map((provider) => {
          const Icon = provider.iconComponent;
          const action = signInWithProviderAction.bind(null, provider.key);

          return (
            <form key={provider.key} action={action}>
              <Button
                type="submit"
                variant="outline"
                size="lg"
                className="w-full gap-2"
              >
                <Icon className="size-4" aria-hidden />
                <span>Continue with {provider.displayName}</span>
              </Button>
            </form>
          );
        })}
      </div>

      <div className="relative">
        <Separator />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="bg-background px-2 text-xs uppercase text-muted-foreground">
            or
          </span>
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/app/\(auth\)/login/oauth-button-list.test.tsx`
Expected: 2 passing.

- [ ] **Step 5: Inject into LoginForm**

Edit `src/app/(auth)/login/login-form.tsx`. Add import at the top:

```tsx
import { OAuthButtonList } from "./oauth-button-list";
```

Inside the returned JSX, between the flash message and the `<form action={formAction}>`, insert:

```tsx
<OAuthButtonList mode="login" />
```

(OAuth button list renders its own bottom separator + "or"; no extra wrapping needed.)

- [ ] **Step 6: Inject into SignupForm**

Edit `src/app/(auth)/signup/signup-form.tsx`. Same pattern: import `OAuthButtonList` from `../login/oauth-button-list` (relative import — the component is pure presentation, shared across both forms), and render `<OAuthButtonList mode="signup" />` between the error alert and the `<form>`.

(If you prefer not to cross the login/signup folder boundary, move the component to `src/app/(auth)/oauth-button-list.tsx` and update imports in both forms. Pick one — a move is simplest but a relative import is also fine.)

- [ ] **Step 7: Run the full unit-test suite**

Run: `pnpm run check`
Expected: All green.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(auth\)/login/oauth-button-list.tsx src/app/\(auth\)/login/oauth-button-list.test.tsx src/app/\(auth\)/login/login-form.tsx src/app/\(auth\)/signup/signup-form.tsx
git commit -m "feat(auth): render OAuth provider buttons on login/signup forms (PP-7kq)"
```

---

## Task 6: Connected Accounts settings section (TDD)

**Files:**

- Create: `src/app/(app)/settings/connected-accounts/connected-accounts-section.tsx`
- Create: `src/app/(app)/settings/connected-accounts/connected-account-row.tsx`
- Create: `src/app/(app)/settings/connected-accounts/connected-accounts-section.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/app/(app)/settings/connected-accounts/connected-accounts-section.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectedAccountRow } from "./connected-account-row";

describe("ConnectedAccountRow", () => {
  it("renders Connect button when provider is not linked", () => {
    render(
      <ConnectedAccountRow
        providerKey="discord"
        displayName="Discord"
        isLinked={false}
        canUnlink={false}
      />
    );
    expect(
      screen.getByRole("button", { name: /connect discord/i })
    ).toBeInTheDocument();
  });

  it("renders enabled Disconnect button when linked and canUnlink", () => {
    render(
      <ConnectedAccountRow
        providerKey="discord"
        displayName="Discord"
        isLinked={true}
        canUnlink={true}
      />
    );
    const btn = screen.getByRole("button", { name: /disconnect discord/i });
    expect(btn).toBeEnabled();
  });

  it("renders disabled Disconnect button with tooltip when linked but only identity", () => {
    render(
      <ConnectedAccountRow
        providerKey="discord"
        displayName="Discord"
        isLinked={true}
        canUnlink={false}
      />
    );
    const btn = screen.getByRole("button", { name: /disconnect discord/i });
    expect(btn).toBeDisabled();
    // Tooltip content: rendered via aria-describedby or via a sibling element;
    // assert the help text is in the DOM.
    expect(
      screen.getByText(/add a password or another provider/i)
    ).toBeInTheDocument();
  });

  it("does not render the Discord email or username (email privacy)", () => {
    render(
      <ConnectedAccountRow
        providerKey="discord"
        displayName="Discord"
        isLinked={true}
        canUnlink={true}
      />
    );
    // There is no email prop — the component has no way to show one.
    // This test guards against future regressions (it's a red flag if
    // someone adds an `email` prop in response to a spec change).
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/\(app\)/settings/connected-accounts/connected-accounts-section.test.tsx`
Expected: FAIL — "Cannot find module './connected-account-row'".

- [ ] **Step 3: Create the row component**

Create `src/app/(app)/settings/connected-accounts/connected-account-row.tsx`:

```tsx
"use client";

import type React from "react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  linkProviderAction,
  unlinkProviderAction,
} from "~/app/(auth)/oauth-actions";
import { providers, type ProviderKey } from "~/lib/auth/providers";

interface ConnectedAccountRowProps {
  providerKey: ProviderKey;
  displayName: string;
  isLinked: boolean;
  /** False when linked but unlinking would leave user with 0 identities. */
  canUnlink: boolean;
}

const UNLINK_DISABLED_MSG =
  "Add a password or another provider before disconnecting this one";

export function ConnectedAccountRow({
  providerKey,
  displayName,
  isLinked,
  canUnlink,
}: ConnectedAccountRowProps): React.JSX.Element {
  const Icon = providers[providerKey].iconComponent;
  const linkAction = linkProviderAction.bind(null, providerKey);
  const unlinkAction = unlinkProviderAction.bind(null, providerKey);

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3">
        <Icon className="size-5" aria-hidden />
        <div>
          <div className="font-medium">{displayName}</div>
          <div className="text-sm text-muted-foreground">
            {isLinked ? "Connected" : "Not connected"}
          </div>
        </div>
      </div>

      {isLinked ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <form action={unlinkAction}>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={!canUnlink}
                    aria-describedby={
                      !canUnlink ? `unlink-${providerKey}-help` : undefined
                    }
                  >
                    Disconnect {displayName}
                  </Button>
                </form>
              </span>
            </TooltipTrigger>
            {!canUnlink && (
              <TooltipContent id={`unlink-${providerKey}-help`}>
                {UNLINK_DISABLED_MSG}
              </TooltipContent>
            )}
          </Tooltip>
          {!canUnlink && (
            <span className="sr-only" id={`unlink-${providerKey}-help`}>
              {UNLINK_DISABLED_MSG}
            </span>
          )}
        </TooltipProvider>
      ) : (
        <form action={linkAction}>
          <Button type="submit">Connect {displayName}</Button>
        </form>
      )}
    </div>
  );
}
```

Note the test `getByText(/add a password.../i)` matches the `sr-only` span, which is always present when `!canUnlink`. Tooltip content is only visible on hover/focus so we include a hidden backup for the test and for screen readers.

- [ ] **Step 4: Create the section wrapper**

Create `src/app/(app)/settings/connected-accounts/connected-accounts-section.tsx`:

```tsx
import type React from "react";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { getLoginUrl } from "~/lib/login-url";
import { providers, type ProviderKey } from "~/lib/auth/providers";
import { canUnlinkIdentity } from "~/lib/auth/identity-guards";
import { ConnectedAccountRow } from "./connected-account-row";

/**
 * Renders one row per registered provider showing connected/disconnected state.
 * Entirely server-rendered — the row component only becomes "use client" to
 * host the unlink-disabled tooltip; all link/unlink logic is in server actions.
 */
export async function ConnectedAccountsSection(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(getLoginUrl("/settings"));
  }

  const { data: identitiesData } = await supabase.auth.getUserIdentities();
  const identities = identitiesData?.identities ?? [];

  const providerKeys = Object.keys(providers) as ProviderKey[];

  return (
    <div>
      <h2 className="text-balance text-xl font-semibold mb-4">
        Connected Accounts
      </h2>
      <p className="text-pretty text-sm text-muted-foreground mb-4">
        Link a third-party account to sign in faster. You can always remove one,
        but you must keep at least one way to sign in.
      </p>
      <div className="divide-y">
        {providerKeys.map((key) => {
          const isLinked = identities.some((i) => i.provider === key);
          const check = canUnlinkIdentity(identities, key);
          const canUnlink = check.ok;

          return (
            <ConnectedAccountRow
              key={key}
              providerKey={key}
              displayName={providers[key].displayName}
              isLinked={isLinked}
              canUnlink={canUnlink}
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/app/\(app\)/settings/connected-accounts/connected-accounts-section.test.tsx`
Expected: 4 passing.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/settings/connected-accounts/
git commit -m "feat(settings): add Connected Accounts section with link/unlink UI (PP-7kq)"
```

---

## Task 7: Wire Connected Accounts into settings page

**Files:**

- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Add the import**

At the top of `src/app/(app)/settings/page.tsx`, near the other local imports, add:

```tsx
import { ConnectedAccountsSection } from "./connected-accounts/connected-accounts-section";
```

- [ ] **Step 2: Insert the section**

In the JSX, locate the Profile Settings `<div>` and its trailing `<Separator />`. Immediately after that separator, insert:

```tsx
<div>
  <ConnectedAccountsSection />
</div>

<Separator />
```

So the flow becomes: Profile Settings → Separator → **Connected Accounts → Separator** → Notification Preferences → Separator → Security → Separator → Danger Zone.

- [ ] **Step 3: Run typecheck + lint**

Run: `pnpm run check`
Expected: All green.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/settings/page.tsx
git commit -m "feat(settings): render Connected Accounts between Profile and Notifications (PP-7kq)"
```

---

## Task 8: Annotate OAuth callback route (no behavior change)

**Files:**

- Modify: `src/app/(auth)/auth/callback/route.ts`

- [ ] **Step 1: Update the JSDoc**

Change the top-of-file JSDoc block to list Discord as an active provider. Replace:

```ts
/**
 * Auth callback route for OAuth flows (Google, GitHub, etc.)
 *
 * Required for CORE-SSR-004 compliance
 *
 * Flow:
 * 1. User clicks "Sign in with Google" → redirected to Google
 * 2. Google redirects back to this route with auth code
 * 3. This route exchanges code for session
 * 4. Redirects to home page
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
```

with:

```ts
/**
 * Auth callback route for OAuth flows.
 *
 * Active providers: Discord (PP-7kq). Google is wired as a config stub
 * (see supabase/config.toml.template) — add a registry entry to enable it.
 *
 * Required for CORE-SSR-004 compliance.
 *
 * Flow:
 * 1. User initiates OAuth via signInWithProviderAction or linkProviderAction
 * 2. Supabase redirects through the provider → back to this route with a code
 * 3. exchangeCodeForSession resolves the code into a session cookie
 * 4. Redirect to `next` (defaults to `/`)
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 * @see src/lib/auth/providers.ts for the provider registry
 */
```

No code changes — the route's exchange logic is provider-agnostic.

- [ ] **Step 2: Run check**

Run: `pnpm run check`
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/auth/callback/route.ts
git commit -m "docs(auth): note Discord as active OAuth provider in callback route (PP-7kq)"
```

---

## Task 9: Integration test — link/unlink round-trip with mocked Supabase auth

**Files:**

- Create: `src/app/(auth)/oauth-actions.integration.test.ts`

- [ ] **Step 1: Write the integration-style test**

Because Supabase Auth's `linkIdentity`/`unlinkIdentity` go out to GoTrue, a true integration test would require a live Supabase instance. For this PR, ship a higher-fidelity test that exercises the full action pipeline end-to-end with a fake Supabase client that records state transitions:

Create `src/app/(auth)/oauth-actions.integration.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { UserIdentity } from "@supabase/supabase-js";

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

async function loadActions() {
  vi.resetModules();
  return import("./oauth-actions");
}

function makeIdentity(provider: string): UserIdentity {
  return {
    identity_id: `id-${provider}`,
    id: `row-${provider}`,
    user_id: "u1",
    identity_data: {},
    provider,
    created_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as UserIdentity;
}

describe("link → unlink round-trip", () => {
  beforeEach(() => {
    process.env["DISCORD_CLIENT_ID"] = "abc";
  });

  it("refuses second unlink once user is back to one identity", async () => {
    const state = {
      identities: [makeIdentity("email"), makeIdentity("discord")],
    };

    const { createClient } = await import("~/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      auth: {
        getUser: async () => ({
          data: { user: { id: "u1" } },
          error: null,
        }),
        getUserIdentities: async () => ({
          data: { identities: [...state.identities] },
          error: null,
        }),
        unlinkIdentity: async (identity: UserIdentity) => {
          state.identities = state.identities.filter(
            (i) => i.provider !== identity.provider
          );
          return { error: null };
        },
      },
    }));

    const { unlinkProviderAction } = await loadActions();

    const first = await unlinkProviderAction("discord");
    expect(first.ok).toBe(true);
    expect(state.identities.map((i) => i.provider)).toEqual(["email"]);

    const second = await unlinkProviderAction("discord");
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("NOT_LINKED");
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm vitest run src/app/\(auth\)/oauth-actions.integration.test.ts`
Expected: 1 passing.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/oauth-actions.integration.test.ts
git commit -m "test(auth): add link→unlink round-trip integration test (PP-7kq)"
```

---

## Task 10: E2E smoke test — OAuth button visible, Connected Accounts renders

**Files:**

- Create: `e2e/full/oauth-connected-accounts.spec.ts`

- [ ] **Step 1: Write the Playwright spec**

Create `e2e/full/oauth-connected-accounts.spec.ts`:

```ts
/**
 * E2E: Connected Accounts section + Discord OAuth button visibility.
 *
 * We deliberately do NOT exercise the full OAuth redirect against the real
 * Discord service in CI (it is flaky, requires dev creds, and triggers
 * Discord's rate limits). Instead we verify:
 *
 *  1. An email/password user sees the Connected Accounts section in settings.
 *  2. Clicking "Connect Discord" triggers a navigation to discord.com.
 *  3. An email/password user sees the "Continue with Discord" button on
 *     login, and clicking it also navigates to discord.com.
 *
 * This requires DISCORD_CLIENT_ID to be set in the test environment. If not
 * set, the spec skips — the spec file documents that explicitly.
 */

import { test, expect } from "@playwright/test";
import { TEST_USERS } from "../support/constants";

test.describe("OAuth + Connected Accounts", () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(
      !process.env["DISCORD_CLIENT_ID"],
      "Requires DISCORD_CLIENT_ID in test env"
    );
  });

  test("Connect Discord button on login redirects to discord.com", async ({
    page,
  }) => {
    await page.goto("/login");
    const button = page.getByRole("button", {
      name: /continue with discord/i,
    });
    await expect(button).toBeVisible();

    await Promise.all([
      page.waitForURL(/discord\.com/, { timeout: 15000 }),
      button.click(),
    ]);
  });

  test("Connected Accounts section renders on settings page", async ({
    page,
    context,
  }) => {
    // Signed-in session is set up via auth.setup.ts fixture (see e2e/auth.setup.ts).
    await page.goto("/settings");

    await expect(
      page.getByRole("heading", { name: /connected accounts/i })
    ).toBeVisible();

    const connectBtn = page.getByRole("button", {
      name: /connect discord/i,
    });
    await expect(connectBtn).toBeVisible();
  });
});
```

Note on auth fixture: the existing `e2e/auth.setup.ts` logs in a seeded user. Follow that pattern if the default test user is not already wired. Verify by opening `e2e/auth.setup.ts` before running.

- [ ] **Step 2: Run the spec (if local env has DISCORD_CLIENT_ID)**

Run: `pnpm exec playwright test e2e/full/oauth-connected-accounts.spec.ts --project=chromium`
Expected: 2 passing, or 2 skipped if no Discord creds locally.

- [ ] **Step 3: Commit**

```bash
git add e2e/full/oauth-connected-accounts.spec.ts
git commit -m "test(e2e): add Connected Accounts + OAuth button smoke test (PP-7kq)"
```

---

## Task 11: Preflight + PR prep

**Files:**

- None (verification)

- [ ] **Step 1: Run preflight**

Run: `pnpm run preflight`
Expected: Green. If failures, fix root cause (do not `--no-verify`).

- [ ] **Step 2: Update bead**

Run: `bd update PP-7kq --status in_review`
Expected: Bead status updated.

- [ ] **Step 3: Push branch**

Run: `git push -u origin feat/oauth-discord-login`
Expected: Remote branch created.

- [ ] **Step 4: Open PR**

Run: `gh pr create --fill --title "feat(auth): OAuth provider framework + Discord login (PP-7kq)" --body-file <(cat <<'EOF'

## Summary

- Adds a multi-provider OAuth registry in `src/lib/auth/providers.ts` (Discord-first, Google slots in with ~25 LOC).
- Adds Discord as the first real OAuth provider via Supabase Auth with `identify email` scopes.
- Adds a Connected Accounts section to `/settings` with link/unlink actions.
- Enforces the "user must retain ≥1 identity" invariant in `unlinkProviderAction` and visually (disabled button + tooltip) via the `canUnlinkIdentity` guard.
- Flips `enable_manual_linking = true` in `supabase/config.toml.template`. Automatic link-by-verified-email is default Supabase behavior — no flag needed (resolves the spec's open question on flag naming).

## Resolved open question

The spec flagged the auto-link flag name as uncertain. Context7 confirmed:

- There is no `enable_linked_identities` flag.
- Automatic linking by verified email is default Supabase behavior and cannot be disabled via `config.toml`.
- `enable_manual_linking` is the only relevant toggle and is required for `linkIdentity()` from the Connected Accounts UI.

## Non-goals (PR 2)

- No Discord bot (PR 3)
- No DM notifications (PR 4)
- No notification failure UX (PR 5)
- No Google OAuth (follow-up PP-cjh)
- No schema migrations

## Test plan

- [x] Unit: provider registry + availability gating
- [x] Unit: canUnlinkIdentity guard (4 cases)
- [x] Unit: server actions (6 cases including ONLY_IDENTITY refusal)
- [x] Component: ConnectedAccountRow three states + email-privacy guard
- [x] Integration: link → unlink round-trip with stateful mock client
- [x] E2E: OAuth button + Connected Accounts rendering (gated on DISCORD_CLIENT_ID)

## Follow-ups

- `PP-cjh`: Google OAuth as add-on using this framework
  EOF
  )`

- [ ] **Step 5: Hand off to pinpoint-commit / pinpoint-ready-to-review**

Invoke the `pinpoint-ready-to-review` skill to watch CI, address Copilot comments, and apply the ready-for-review label.

---

## Risks (document in PR body)

1. **Case-mismatched email orphans.** Supabase auto-link-by-email uses exact case-insensitive match on verified emails. If a user signs up as `Alice@example.com` via password and later signs in via Discord with `alice@example.com`, Supabase normalizes and links. But if the Discord identity's email has whitespace or a zero-width character (rare but possible), we create an orphan. Mitigation: v1 accepts this corner; log every OAuth sign-in with both emails and monitor for orphans after launch. Add a follow-up bead if orphans appear.

2. **Scope drift.** Decision #9 is `identify email`. Discord does not require `guilds` for our use case — PR 3 moves membership checks server-side via the bot API. Future contributors may be tempted to add `guilds` here; the scope string is central to the provider object so a reviewer can catch it.

3. **Token refresh edge cases.** Supabase manages OAuth refresh tokens transparently via the SSR middleware. Our middleware already calls `supabase.auth.getUser()` on every request (verified). No work here beyond ensuring `createClient() → getUser()` discipline remains intact.

4. **Manual linking cross-site token reuse.** Supabase's `linkIdentity()` requires `enable_manual_linking = true`. This flag only opens the endpoint to _authenticated_ callers; there is no CSRF exposure beyond what already exists for Supabase auth endpoints.

5. **Unlink race.** Between `getUserIdentities()` and `unlinkIdentity()`, another tab could link/unlink. The worst case is `unlinkIdentity()` returning an error, which surfaces as `SERVER` in the action result. Acceptable; not worth a transaction.

6. **Last-identity race.** Two browser tabs could each see two identities and both try to unlink. Supabase Auth's `unlinkIdentity` does not enforce the ≥1 invariant server-side; we enforce it in the action, which reads state then acts, so a race could still leave a user with 0 identities. Mitigation: rare in practice (requires fast double-click from two tabs), and recovery exists via password reset email. If this becomes a real issue, future work could add a post-unlink re-query with re-link rollback.

## Explicit non-goals (restated)

- No bot client, no DM sending code, no Discord bot token handling — PR 3.
- No notification preferences schema changes (`discordEnabled` etc.) — PR 4.
- No failure-detection / system alerts — PR 5.
- No Google, GitHub, or any other provider registry entry — follow-up beads.
- No changes to `auth/callback/route.ts` beyond JSDoc comments.

## Self-review checklist (for the engineer executing this plan)

Before submitting the PR:

- [ ] Every task above has all steps checked.
- [ ] No `any`, no `!`, no unsafe `as` in new code (AGENTS.md #7).
- [ ] All new imports use `~/` path aliases (AGENTS.md #8).
- [ ] `createClient()` is always immediately followed by `auth.getUser()` (AGENTS.md #6).
- [ ] No client-side viewport JS (`window.innerWidth`, `useMediaQuery`) introduced (AGENTS.md #16).
- [ ] No permission helpers outside `src/lib/permissions/` created (AGENTS.md #14) — we use no permission checks here, which is correct because linking your own identity is not permissioned.
- [ ] No email addresses rendered outside admin/self views (AGENTS.md #12). The Connected Accounts row intentionally shows only the provider name and connected/disconnected state.
- [ ] `pnpm run preflight` green.
