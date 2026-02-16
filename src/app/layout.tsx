import type { Metadata } from "next";
import type React from "react";
import "./globals.css";
import { Toaster } from "sonner";
import { ClientLogger } from "~/components/dev/client-logger";

import { CookieConsentBanner } from "~/components/CookieConsentBanner";
import { SentryInitializer } from "~/components/SentryInitializer";

export const metadata: Metadata = {
  title: "PinPoint - Pinball Machine Issue Tracking",
  description:
    "Issue tracking for pinball machines at Austin Pinball Collective",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col h-screen overflow-hidden">
        <SentryInitializer />
        {isDevelopment && <ClientLogger />}
        <div className="flex-1 overflow-hidden">{children}</div>
        <Toaster />
        <CookieConsentBanner />
      </body>
    </html>
  );
}
