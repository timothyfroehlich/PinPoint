import { AuthenticatedLayout } from "./_components/AuthenticatedLayout";
import Providers from "./providers";

import type { JSX } from "react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <head>
        <title>PinPoint</title>
      </head>
      <body>
        <Providers>
          <AuthenticatedLayout>{children}</AuthenticatedLayout>
        </Providers>
      </body>
    </html>
  );
}
