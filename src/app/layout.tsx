import type { Metadata } from "next";
import type React from "react";
import "./globals.css";
import { Toaster } from "sonner";
import { ClientLogger } from "~/components/dev/client-logger";

import { SentryInitializer } from "~/components/SentryInitializer";

import { PreBetaBanner } from "~/components/layout/PreBetaBanner";

export const metadata: Metadata = {
  title: "PinPoint - Pinball Machine Issue Tracking",
  description:
    "Issue tracking for pinball machines at Austin Pinball Collective",
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
        <PreBetaBanner />
        <div className="flex-1 overflow-hidden">{children}</div>
        <Toaster />
      </body>
    </html>
  );
}
