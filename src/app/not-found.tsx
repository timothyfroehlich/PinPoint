import type React from "react";
import Link from "next/link";

import { Button } from "~/components/ui/button";

/**
 * Global 404 Not Found page.
 *
 * Shown when a page doesn't exist. Works for both authenticated
 * and unauthenticated users.
 */
export default function NotFound(): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-muted-foreground/20">404</h1>
        <h2 className="mt-4 text-2xl font-semibold">Page not found</h2>
        <p className="mt-2 text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/">Go to Home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/m">Browse Machines</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/issues">Browse Issues</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
