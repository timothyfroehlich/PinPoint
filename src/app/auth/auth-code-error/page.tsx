import type { ReactElement } from "react";

export default function AuthCodeErrorPage(): ReactElement {
  return (
    <main className="mx-auto max-w-lg p-6">
      <section className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Sign-in Error</h1>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t complete your sign-in. The authorization code was
          missing or invalid.
        </p>
        <div className="pt-2">
          <a href="/" className="underline">
            Return to home
          </a>
        </div>
      </section>
    </main>
  );
}
