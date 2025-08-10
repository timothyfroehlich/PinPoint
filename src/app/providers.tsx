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
          {/* Apply hydration safety inside providers to maintain context */}
          {mounted ? (
            children
          ) : (
            <div style={{ visibility: "hidden" }}>{children}</div>
          )}
        </ThemeProvider>
      </TRPCReactProvider>
    </AuthProvider>
  );
}
