import type { Metadata } from "next";
// Force load Sentry client config
import "~/sentry.client.config";
import type React from "react";
import "./globals.css";
import { ClientLogger } from "~/components/dev/client-logger";

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
    <html lang="en">
      <body>
        {isDevelopment && <ClientLogger />}
        {children}
      </body>
    </html>
  );
}
