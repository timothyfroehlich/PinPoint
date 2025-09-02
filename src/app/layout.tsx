import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Navigation } from "~/components/layout/navigation";
import { getOrganizationContext } from "~/lib/organization-context";
import Providers from "./providers";
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
}): Promise<React.JSX.Element> {
  const organizationContext = await getOrganizationContext();

  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-background">
            <Navigation organizationContext={organizationContext} />
            <main className="container mx-auto px-4 py-8">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
