import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";

import { AuthenticatedLayout } from "./_components/AuthenticatedLayout";
import Providers from "./providers";

import type { JSX } from "react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>PinPoint</title>
      </head>
      <body>
        <InitColorSchemeScript attribute="data" />
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <Providers>
            <AuthenticatedLayout>{children}</AuthenticatedLayout>
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
