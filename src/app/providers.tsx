"use client";

import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import { ThemeProvider } from "@mui/material/styles";
import { type ReactNode, type JSX } from "react";

import { AuthProvider } from "./auth-provider";
import theme from "./theme";

import { TRPCReactProvider } from "~/trpc/react";

export default function Providers({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
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
