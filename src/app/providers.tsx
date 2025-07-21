"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { type ReactNode, type JSX } from "react";

import theme from "./theme";
import { TRPCReactProvider } from "~/trpc/react";

export default function Providers({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <TRPCReactProvider>
      <ThemeProvider theme={theme}>
        {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
        <CssBaseline />
        {children}
      </ThemeProvider>
    </TRPCReactProvider>
  );
}
