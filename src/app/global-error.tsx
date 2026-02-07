"use client";

import * as Sentry from "@sentry/nextjs";
import type React from "react";
import { useEffect } from "react";

/**
 * Global error boundary — catches errors that escape the root layout.
 *
 * Because this replaces the entire <html>, it cannot use the app's theme
 * provider or component library. Styles are inlined for reliability.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}): React.JSX.Element {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 1rem",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                fontSize: "8rem",
                fontWeight: 700,
                color: "rgba(0,0,0,0.1)",
                margin: 0,
              }}
            >
              500
            </h1>
            <h2 style={{ marginTop: "1rem", fontSize: "1.5rem" }}>
              Something went wrong
            </h2>
            <p style={{ marginTop: "0.5rem", color: "#666" }}>
              A critical error occurred. Please refresh the page or return to
              the home page.
            </p>
            <div
              style={{
                marginTop: "2rem",
                display: "flex",
                gap: "1rem",
                justifyContent: "center",
              }}
            >
              <a
                href="/"
                style={{
                  padding: "0.5rem 1rem",
                  background: "#000",
                  color: "#fff",
                  borderRadius: "0.375rem",
                  textDecoration: "none",
                }}
              >
                Go Home
              </a>
            </div>
            {error.digest && (
              <p
                style={{
                  marginTop: "2rem",
                  fontSize: "0.75rem",
                  color: "rgba(0,0,0,0.3)",
                }}
              >
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
