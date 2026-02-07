import type React from "react";
import Image from "next/image";

/**
 * Organization Banner Component
 * Displays the organization's logo/branding on the dashboard
 * Currently configured for Austin Pinball Collective (APC)
 *
 * Future: Make this configurable via environment variables or database settings
 */
export function OrganizationBanner(): React.JSX.Element {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3">
        <a
          href="https://austinpinballcollective.org"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Austin Pinball Collective"
        >
          <Image
            src="/apc-logo.png"
            alt="Austin Pinball Collective"
            width={180}
            height={120}
            className="w-auto h-auto max-h-full object-contain drop-shadow-[0_0_15px_color-mix(in_srgb,var(--color-primary)_50%,transparent)] hover:drop-shadow-[0_0_20px_color-mix(in_srgb,var(--color-primary)_70%,transparent)] transition-all duration-300"
            priority
          />
        </a>
      </div>
    </div>
  );
}
