import type React from "react";
import { notFound } from "next/navigation";
import { MainLayout } from "~/components/layout/MainLayout";
import { isVercelProduction } from "~/lib/runtime-env";

export default function DevLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  if (isVercelProduction()) {
    notFound();
  }

  return <MainLayout>{children}</MainLayout>;
}
