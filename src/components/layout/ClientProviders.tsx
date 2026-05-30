"use client";

import type React from "react";
import { TooltipProvider } from "~/components/ui/tooltip";
import { RelativeTimeProvider } from "~/components/issues/RelativeTimeProvider";

/**
 * Global client-side providers wrapper.
 *
 * TooltipProvider is placed here (rather than in individual components) so:
 * 1. There is a single provider in the tree, preventing "missing provider" crashes.
 * 2. delayDuration={300} is enforced consistently across all tooltips.
 *
 * Exception: CopyButton keeps its own local <TooltipProvider delayDuration={0}>
 * so that the "Copied!" tooltip appears instantly after a click.
 *
 * RelativeTimeProvider is mounted here so that all RelativeTime instances in the
 * app share a single 60-second interval instead of each running their own timer.
 */
export function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <TooltipProvider delayDuration={300}>
      <RelativeTimeProvider>{children}</RelativeTimeProvider>
    </TooltipProvider>
  );
}
