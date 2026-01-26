"use client";

import type React from "react";
import Image from "next/image";
import { Card } from "~/components/ui/card";

/**
 * Organization Banner Component
 * Displays the organization's logo/branding on the dashboard
 * Currently configured for Austin Pinball Collective (APC)
 *
 * Future: Make this configurable via environment variables or database settings
 */
export function OrganizationBanner(): React.JSX.Element {
  return (
    <Card className="h-full flex items-center justify-center border-primary/20 bg-card/50 backdrop-blur-sm p-6">
      <div className="flex flex-col items-center gap-3">
        <Image
          src="/apc-logo.png"
          alt="Austin Pinball Collective"
          width={180}
          height={120}
          className="w-auto h-auto max-h-full object-contain drop-shadow-[0_0_12px_rgba(74,222,128,0.25)]"
          priority
        />
      </div>
    </Card>
  );
}
