import { type Metadata } from "next";
import { Inter } from "next/font/google";
import { AppProviders } from "./providers";
import { TRPCReactProvider } from "~/trpc/react";
import { AppBar, Toolbar, Typography } from "@mui/material";
import { AuthButton } from "./_components/auth-button";
import { ImpersonationMenu } from "./_components/dev/impersonation-menu";

export const metadata: Metadata = {
  title: "PinPoint",
  description: "A simple game tracking application",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body>
        <TRPCReactProvider>
          <AppProviders>
            <AppBar position="static">
              <Toolbar>
                <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                  PinPoint
                </Typography>
                <AuthButton />
              </Toolbar>
            </AppBar>
            {children}
            {process.env.NODE_ENV === "development" && <ImpersonationMenu />}
          </AppProviders>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
