import type React from "react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { getAvailableProviders } from "~/lib/auth/providers";
import { signInWithProviderAction } from "~/app/(auth)/oauth-actions";

/**
 * Renders one progressive-enhancement <form action> per available provider.
 *
 * Server Component — iterates the provider registry at render time and reads
 * the `DISCORD_CLIENT_ID` env var (server-only). The wrapping `<form>` is how
 * we keep this JS-free: no onClick handler, progressive enhancement works.
 *
 * When no providers are configured, renders `null` (no stray separator).
 */
export function OAuthButtonList(): React.JSX.Element | null {
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
