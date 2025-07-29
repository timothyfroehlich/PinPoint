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
        <AppRouterCacheProvider
          options={{
            key: "mui-app",
            enableCssLayer: true,
            prepend: true,
            speedy: false,
          }}
        >
          <Providers>
            <AuthenticatedLayout>{children}</AuthenticatedLayout>
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
