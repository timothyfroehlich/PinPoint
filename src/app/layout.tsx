import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import Providers from "./providers";
import { ClientProviders } from "./client-providers";
import { ServerNavigation } from "~/components/layout/ServerNavigation";
import "./globals.css";

import type { JSX } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PinPoint - Pinball Machine Management",
  description: "Manage your pinball machines, track issues, and optimize operations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>PinPoint</title>
      </head>
      <body className={`${inter.className} bg-background text-foreground`}>
        <AppRouterCacheProvider
          options={{
            key: "mui-app",
            enableCssLayer: true,
            prepend: true,
            speedy: false,
          }}
        >
          <div className="min-h-screen bg-background">
            {/* Server-rendered navigation (Phase 1D) */}
            <ServerNavigation />
            
            {/* Main content area */}
            <div className="md:ml-64">
              <main className="min-h-screen">
                <Providers>
                  <ClientProviders>
                    {children}
                  </ClientProviders>
                </Providers>
              </main>
            </div>
          </div>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
