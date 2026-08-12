"use client";

import type React from "react";
import { useEffect } from "react";
import { TooltipProvider } from "~/components/ui/tooltip";
import { RelativeTimeProvider } from "~/components/issues/RelativeTimeProvider";

/**
 * Marks the document once React has hydrated, so tests can tell "painted" from
 * "interactive".
 *
 * Playwright's actionability checks cover visible, stable, enabled and receives-
 * events — none of which know whether React has attached a handler yet. A click
 * in that window hits a live-looking control and is silently discarded, and the
 * spec then fails wherever it next asserts the consequence: a Radix portal that
 * never opened, a Sheet that never appeared, a navigation that never happened.
 * Raising timeouts cannot help, because after a dropped click nothing is
 * pending. (PP-jxhy.)
 *
 * This ships in production too. It is one attribute set once, and an attribute
 * that exists only under test is an attribute whose absence nobody notices when
 * it breaks.
 */
function HydrationBeacon(): null {
  useEffect(() => {
    document.documentElement.dataset["hydrated"] = "1";
  }, []);
  return null;
}

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
      <HydrationBeacon />
      <RelativeTimeProvider>{children}</RelativeTimeProvider>
    </TooltipProvider>
  );
}
