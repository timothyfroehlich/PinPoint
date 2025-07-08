import { type Metadata } from "next";
import { Inter } from "next/font/google";
import { AppProviders } from "./providers";
import { TRPCReactProvider } from "~/trpc/react";
import { AppBar, Toolbar, Typography, Box } from "@mui/material";
import Link from "next/link";
import Image from "next/image";
import { AuthButton } from "./_components/auth-button";
import { NavigationLinks } from "./_components/navigation-links";
import { DevLoginCompact } from "./_components/dev/dev-login-compact";
import { api } from "~/trpc/server";

export const metadata: Metadata = {
  title: "PinPoint",
  description: "A simple game tracking application",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const organization = await api.organization.getCurrent();

  return (
    <html lang="en" className={`${inter.variable}`}>
      <body>
        <TRPCReactProvider>
          <AppProviders>
            <AppBar position="static">
              <Toolbar>
                <Box
                  component={Link}
                  href="/"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    textDecoration: "none",
                    color: "inherit",
                    "&:hover": {
                      opacity: 0.8,
                    },
                  }}
                >
                  {organization?.logoUrl && (
                    <Image
                      src={organization.logoUrl}
                      alt={`${organization.name} Logo`}
                      width={40}
                      height={40}
                      style={{ marginRight: "10px" }}
                    />
                  )}
                  <Typography variant="h6" component="div">
                    PinPoint
                  </Typography>
                </Box>
                <Box sx={{ flexGrow: 1 }} />
                <NavigationLinks />
                <AuthButton />
              </Toolbar>
            </AppBar>
            {children}
            <DevLoginCompact />
          </AppProviders>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
