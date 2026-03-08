"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { hasCookieConsent, storeCookieConsent } from "~/lib/cookies/client";

export function CookieConsentBanner(): React.JSX.Element | null {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasCookieConsent()) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-50 max-w-[calc(100vw-2rem)] rounded-lg border bg-background p-4 shadow-lg animate-in fade-in slide-in-from-bottom-2 sm:bottom-4 sm:max-w-sm"
      role="region"
      aria-label="Cookie consent notice"
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          PinPoint uses cookies for authentication and to remember your
          preferences.{" "}
          <Link
            href="/privacy"
            className="text-link underline hover:text-foreground"
          >
            Learn more
          </Link>
        </p>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              storeCookieConsent();
              setVisible(false);
            }}
          >
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
