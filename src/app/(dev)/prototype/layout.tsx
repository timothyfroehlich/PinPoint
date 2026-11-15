import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isProductionBuild, isVercelProduction } from "~/lib/runtime-env";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function PrototypeLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  if (isVercelProduction() || isProductionBuild()) {
    notFound();
  }

  return <>{children}</>;
}
