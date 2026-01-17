"use client";

import type React from "react";
import { useEffect, useState } from "react";

/**
 * OnlookProvider: Wraps the app to enable Onlook visual editor in development mode.
 *
 * Onlook is a visual-first code editor that allows designers and developers to:
 * - Edit components visually in the browser
 * - Rearrange elements with drag-and-drop
 * - Adjust Tailwind styles in real-time
 * - Use AI-powered design suggestions
 *
 * This component only activates when:
 * 1. NODE_ENV is "development"
 * 2. NEXT_PUBLIC_ONLOOK_ENABLED is "true"
 *
 * The @onlook/nextjs SWC plugin adds data-onlook-id attributes to elements,
 * which Onlook's desktop app or web interface uses to identify and edit components.
 *
 * @see https://github.com/onlook-dev/onlook
 */
export function OnlookProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [isOnlookEnabled, setIsOnlookEnabled] = useState(false);

  useEffect(() => {
    // Only check in development mode
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    // Check if Onlook is enabled via environment variable
    const enabled =
      process.env["NEXT_PUBLIC_ONLOOK_ENABLED"] === "true" ||
      process.env["NEXT_PUBLIC_ONLOOK_ENABLED"] === "1";

    setIsOnlookEnabled(enabled);

    if (enabled) {
      console.log(
        "[Onlook] Visual editor enabled. Connect with Onlook desktop app or web interface."
      );
      console.log("[Onlook] See: https://github.com/onlook-dev/onlook");
    }
  }, []);

  // Add a data attribute to indicate Onlook is active
  return (
    <div
      data-onlook-enabled={isOnlookEnabled}
      className="contents"
      suppressHydrationWarning
    >
      {children}
    </div>
  );
}
