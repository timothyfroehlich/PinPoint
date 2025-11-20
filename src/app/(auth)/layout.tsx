import type React from "react";
import Link from "next/link";
import { CircleDot } from "lucide-react";

/**
 * Layout for authentication pages (login, signup)
 *
 * Provides centered card layout with PinPoint branding
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and title */}
        <Link
          href="/"
          className="flex items-center justify-center gap-3 mb-8 group"
        >
          <CircleDot
            className="size-8 text-primary group-hover:text-primary/80 transition-colors"
            strokeWidth={2.5}
          />
          <h1 className="text-4xl font-bold tracking-tight text-primary group-hover:text-primary/80 transition-colors">
            PinPoint
          </h1>
        </Link>

        {/* Auth form content */}
        {children}
      </div>
    </main>
  );
}
