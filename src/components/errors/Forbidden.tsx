import type React from "react";
import Link from "next/link";

import { Button } from "~/components/ui/button";

interface ForbiddenProps {
  /** The user's current role, if authenticated */
  role?: "guest" | "member" | "admin" | null;
  /** Optional custom message */
  message?: string;
  /** Where to redirect when clicking "Go Back" - defaults to /dashboard */
  backUrl?: string;
}

/**
 * 403 Forbidden component.
 *
 * Shown when an authenticated user tries to access a page they don't
 * have permission for (e.g., guest trying to access /admin).
 *
 * Usage in layouts:
 * ```tsx
 * if (profile?.role !== "admin") {
 *   return <Forbidden role={profile?.role} />;
 * }
 * ```
 */
export function Forbidden({
  role,
  message,
  backUrl = "/dashboard",
}: ForbiddenProps): React.JSX.Element {
  const roleLabel = role
    ? role.charAt(0).toUpperCase() + role.slice(1)
    : "Unknown";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-muted-foreground/20">403</h1>
        <h2 className="mt-4 text-2xl font-semibold">Access Denied</h2>
        <p className="mt-2 text-muted-foreground">
          {message ?? "You don't have permission to access this page."}
        </p>
        {role && (
          <p className="mt-1 text-sm text-muted-foreground">
            Your current role: <span className="font-medium">{roleLabel}</span>
          </p>
        )}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href={backUrl}>Go Back</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
