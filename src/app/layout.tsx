import { type Metadata } from "next";
import { Inter } from "next/font/google";
import { AppProviders } from "./providers";
import { TRPCReactProvider } from "~/trpc/react";
import { AppBar, Toolbar, Typography, Box } from "@mui/material";
import Link from "next/link";
import { AuthButton } from "./_components/auth-button";
import { DevLoginCompact } from "./_components/dev/dev-login-compact";

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
                <Typography
                  variant="h6"
                  component={Link}
                  href="/"
                  sx={{
                    flexGrow: 1,
                    textDecoration: "none",
                    color: "inherit",
                    cursor: "pointer",
                    "&:hover": {
                      opacity: 0.8,
                    },
                  }}
                >
                  PinPoint
                </Typography>
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 2, mr: 2 }}
                >
                  <Typography
                    component={Link}
                    href="/issues"
                    sx={{
                      textDecoration: "none",
                      color: "inherit",
                      "&:hover": {
                        opacity: 0.8,
                      },
                    }}
                  >
                    Issues
                  </Typography>
                </Box>
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
