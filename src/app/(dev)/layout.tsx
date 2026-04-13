import type React from "react";
import { MainLayout } from "~/components/layout/MainLayout";

export default function DevLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <MainLayout>{children}</MainLayout>;
}
