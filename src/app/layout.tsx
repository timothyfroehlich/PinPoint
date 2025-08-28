import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getServerAuth } from "~/lib/auth/server-auth";
import { Navigation } from "~/components/layout/navigation";
import { GlobalSearchShortcut } from "~/components/search";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PinPoint - Pinball Machine Issue Tracking",
  description: "Professional pinball machine maintenance and issue tracking",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get authentication context (optional - doesn't redirect)
  const authContext = await getServerAuth();

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          <Navigation authContext={authContext} />
          <main className="container mx-auto px-4 py-8">{children}</main>
          
          {/* Global Search Shortcut (Cmd/Ctrl+K) */}
          {authContext && <GlobalSearchShortcut />}
        </div>
      </body>
    </html>
  );
}
