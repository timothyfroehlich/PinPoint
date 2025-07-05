"use client";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { SessionProvider } from "next-auth/react";

const theme = createTheme({
  typography: {
    fontFamily:
      'var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  palette: {
    mode: "light",
    primary: {
      main: "#2563eb",
    },
    secondary: {
      main: "#7c3aed",
    },
  },
});

function MaterialUIProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <MaterialUIProvider>{children}</MaterialUIProvider>
    </SessionProvider>
  );
}
