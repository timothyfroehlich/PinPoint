// Tunnel route to bypass ad blockers for Sentry
// https://docs.sentry.io/platforms/javascript/guides/nextjs/troubleshooting/#using-the-tunnel-option

import type { NextRequest } from "next/server";

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const envelope = await req.text();
    const envelopeLines = envelope.split("\n");

    // Extract the DSN from the first line (header)
    const headerLine = envelopeLines[0];
    if (!headerLine) {
      return new Response(null, { status: 400 });
    }

    let header: { dsn?: string };
    try {
      header = JSON.parse(headerLine) as { dsn?: string };
    } catch {
      return new Response(null, { status: 400 });
    }

    const dsnString = header.dsn;
    if (!dsnString) {
      return new Response(null, { status: 400 });
    }

    // Validate DSN matches expected project
    const expectedDsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];
    // We check if the provided DSN matches the configured one (ignoring potential protocol differences if needed, but exact match is safer)
    // Sentry SDK sends full DSN
    if (!expectedDsn || dsnString !== expectedDsn) {
      console.warn("Sentry tunnel: Blocked invalid DSN", dsnString);
      return new Response(null, { status: 403 });
    }

    const dsn = new URL(dsnString);
    const projectId = dsn.pathname.replace("/", "");

    // Forward to Sentry
    const sentryIngestUrl = `https://${dsn.host}/api/${projectId}/envelope/`;
    const response = await fetch(sentryIngestUrl, {
      method: "POST",
      body: envelope,
      headers: {
        "Content-Type": "application/x-sentry-envelope",
      },
    });

    return new Response(null, { status: response.status });
  } catch (error) {
    console.error("Sentry tunnel error:", error);
    return new Response(null, { status: 500 });
  }
}
