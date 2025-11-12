import type React from "react";
import Link from "next/link";
import { CircleDot } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export default function HomePage(): React.JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-outline-variant bg-surface shadow-2xl">
        <CardHeader className="space-y-3 text-center pb-8">
          <div className="flex items-center justify-center gap-3">
            <CircleDot className="size-10 text-primary" strokeWidth={2.5} />
            <CardTitle className="text-6xl font-bold tracking-tight text-primary">
              PinPoint
            </CardTitle>
          </div>
          <p className="text-xl text-on-surface-variant font-medium">
            Pinball Machine Issue Tracking
          </p>
        </CardHeader>

        <CardContent className="space-y-8 px-8 pb-8">
          <p className="text-center text-base leading-relaxed text-on-surface">
            Report and track issues with pinball machines at the Austin Pinball
            Collective. Help keep our machines running smoothly for everyone to
            enjoy.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              asChild
              size="lg"
              className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container transition-colors"
            >
              <Link href="/auth/signup">Sign Up</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-outline text-primary hover:bg-surface-variant transition-colors"
            >
              <Link href="/auth/login">Sign In</Link>
            </Button>
          </div>

          <div className="border-t border-outline-variant pt-6 text-center space-y-3">
            <p className="text-sm text-on-surface-variant">
              Want to report an issue without creating an account?
            </p>
            <Button
              asChild
              variant="secondary"
              className="bg-secondary-container text-on-secondary-container hover:bg-secondary hover:text-on-secondary transition-colors"
            >
              <Link href="/report">Report an Issue</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
