import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
  if (
    process.env["VERCEL_ENV"] === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    notFound();
  }

  return <>{children}</>;
}
