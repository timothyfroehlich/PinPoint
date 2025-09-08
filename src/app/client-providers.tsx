"use client";

import { TRPCReactProvider } from "~/trpc/react";
import { ThemeProvider } from "next-themes";

export function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <TRPCReactProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </TRPCReactProvider>
  );
}
