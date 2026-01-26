"use client";

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
        <Image
          src="/apc-logo.png"
          alt="Austin Pinball Collective"
          width={180}
          height={120}
          className="w-auto h-auto max-h-full object-contain drop-shadow-[0_0_15px_rgba(74,222,128,0.5)] hover:drop-shadow-[0_0_20px_rgba(74,222,128,0.7)] transition-all duration-300"
          priority
        />
      </div>
    </div>
  );
}
