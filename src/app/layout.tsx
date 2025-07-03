import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { MaterialUIProvider } from "./providers";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "PinPoint",
  description: "A simple game tracking application",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body>
        <MaterialUIProvider>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </MaterialUIProvider>
      </body>
    </html>
  );
}
