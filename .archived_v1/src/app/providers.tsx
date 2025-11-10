"use client";

import { type ReactNode, useEffect, useState } from "react";

import { AuthProvider } from "./auth-provider";

import { TRPCReactProvider } from "~/trpc/react";

export default function Providers({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  // Prevent hydration mismatch by ensuring client-side rendering consistency
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <AuthProvider>
      <TRPCReactProvider>
        {/* Apply hydration safety inside providers to maintain context */}
        {mounted ? (
          children
        ) : (
          <div style={{ visibility: "hidden" }}>{children}</div>
        )}
      </TRPCReactProvider>
    </AuthProvider>
  );
}
