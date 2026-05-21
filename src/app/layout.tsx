import type { Metadata } from "next";
import type React from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { Toaster } from "sonner";
import { ClientLogger } from "~/components/dev/client-logger";

import { CookieConsentBanner } from "~/components/CookieConsentBanner";
import { SentryInitializer } from "~/components/SentryInitializer";
import { ClientProviders } from "~/components/layout/ClientProviders";
import { DEV_SHOW_COOKIE_BANNER_KEY } from "~/lib/cookies/constants";

export const metadata: Metadata = {
  title: "PinPoint - Pinball Machine Issue Tracking",
  description:
    "Issue tracking for pinball machines at Austin Pinball Collective",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
};

/**
 * Derives the Vercel Blob public hostname from the BLOB_READ_WRITE_TOKEN.
 * Token format: vercel_blob_rw_<storeRef>_<base64secret>
 * Hostname format: <storeRef>.public.blob.vercel-storage.com
 * Returns null when the token is absent (local dev without blob credentials).
 */
function getBlobStoreHostname(): string | null {
  const token = process.env["BLOB_READ_WRITE_TOKEN"];
  if (!token) return null;
  // Strip the "vercel_blob_rw_" prefix, then take the next segment before "_"
  const withoutPrefix = token.replace(/^vercel_blob_rw_/, "");
  const storeRef = withoutPrefix.split("_")[0];
  if (!storeRef) return null;
  return `${storeRef}.public.blob.vercel-storage.com`;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.JSX.Element> {
  const isDevelopment = process.env.NODE_ENV === "development";

  const isProduction =
    process.env["VERCEL_ENV"] === "production" ||
    (!process.env["VERCEL_ENV"] && process.env.NODE_ENV === "production");

  let forceShow = false;
  if (!isProduction) {
    const cookieStore = await cookies();
    forceShow = cookieStore.get(DEV_SHOW_COOKIE_BANNER_KEY)?.value === "true";
  }

  const showCookieBanner = isProduction || forceShow;
  const blobHostname = getBlobStoreHostname();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {blobHostname !== null && (
          <link rel="preconnect" href={`https://${blobHostname}`} />
        )}
      </head>
      <body className="flex flex-col h-screen overflow-hidden">
        <ClientProviders>
          <SentryInitializer />
          {isDevelopment && <ClientLogger />}
          <div className="flex-1 overflow-hidden">{children}</div>
          <Toaster />
          {showCookieBanner && <CookieConsentBanner />}
        </ClientProviders>
      </body>
    </html>
  );
}
