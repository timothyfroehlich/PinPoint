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
