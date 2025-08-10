"use client";

import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import { ThemeProvider } from "@mui/material/styles";
import { type ReactNode, type JSX, useEffect, useState } from "react";

import { AuthProvider } from "./auth-provider";
import theme from "./theme";

import { TRPCReactProvider } from "~/trpc/react";

export default function Providers({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  // Prevent hydration mismatch by ensuring client-side rendering consistency
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show nothing on server/initial render to prevent hydration mismatch
  if (!mounted) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  return (
    <AuthProvider>
      <TRPCReactProvider>
        <ThemeProvider theme={theme}>
          <GlobalStyles
            styles={{
              "@layer mui, base;": "",
            }}
          />
          {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
          <CssBaseline />
          {children}
        </ThemeProvider>
      </TRPCReactProvider>
    </AuthProvider>
  );
}
