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
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4">
      <div className="mx-auto flex max-w-screen-xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          PinPoint uses cookies for authentication and to remember your
          preferences.{" "}
          <Link href="/privacy" className="text-link underline">
            Learn more
          </Link>
        </p>
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
  );
}
