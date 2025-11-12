import type React from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export default function HomePage(): React.JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-background)] p-4">
      <Card className="w-full max-w-2xl border-[var(--color-outline-variant)] bg-[var(--color-surface)] shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="mb-2 text-5xl font-bold text-[var(--color-primary)]">
            PinPoint
          </CardTitle>
          <p className="text-2xl text-[var(--color-on-surface-variant)]">
            Pinball Machine Issue Tracking
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-lg text-[var(--color-on-surface)]">
            Report and track issues with pinball machines at the Austin Pinball
            Collective. Help keep our machines running smoothly for everyone to
            enjoy.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button
              asChild
              className="bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-container)] hover:text-[var(--color-on-primary-container)]"
            >
              <Link href="/auth/signup">Sign Up</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-[var(--color-outline)] text-[var(--color-primary)] hover:bg-[var(--color-surface-variant)]"
            >
              <Link href="/auth/login">Sign In</Link>
            </Button>
          </div>

          <div className="border-t border-[var(--color-outline-variant)] pt-4 text-center">
            <p className="mb-3 text-sm text-[var(--color-on-surface-variant)]">
              Want to report an issue without creating an account?
            </p>
            <Button
              asChild
              variant="secondary"
              className="bg-[var(--color-secondary-container)] text-[var(--color-on-secondary-container)] hover:bg-[var(--color-secondary)]"
            >
              <Link href="/report">Report an Issue</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
