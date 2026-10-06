import type React from "react";
import { notFound } from "next/navigation";
import { MainLayout } from "~/components/layout/MainLayout";

export default function DevLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  if (process.env["VERCEL_ENV"] === "production") {
    notFound();
  }

  return <MainLayout>{children}</MainLayout>;
}
