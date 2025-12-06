"use client";

/* eslint-disable no-undef -- Browser globals not in default config */

import type React from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LoadingClient({
  nextPath,
}: {
  nextPath: string;
}): React.JSX.Element {
  const router = useRouter();

  useEffect(() => {
    const hasSupabaseAuthCookie = (): boolean => {
      return document.cookie
        .split(";")
        .map((cookie) => cookie.trim())
        .some(
          (cookie) => cookie.startsWith("sb-") && cookie.includes("auth-token")
        );
    };

    let cancelled = false;
    const start = performance.now();
    const maxWaitMs = 2000;

    const tick = (): void => {
      if (cancelled) return;

      const elapsed = performance.now() - start;
      if (hasSupabaseAuthCookie() || elapsed > maxWaitMs) {
        router.replace(nextPath);
        return;
      }

      requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelled = true;
    };
  }, [nextPath, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="rounded-lg border border-outline-variant bg-surface shadow-md">
        <div className="px-6 py-4 text-center text-on-surface">
          <p className="text-sm font-medium">Finalizing sign-in…</p>
          <p className="text-xs text-on-surface-variant">
            One moment while we finish securing your session.
          </p>
        </div>
      </div>
    </main>
  );
}
