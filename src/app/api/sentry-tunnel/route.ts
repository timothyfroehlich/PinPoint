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

    const header = JSON.parse(headerLine) as { dsn?: string };
    const dsnString = header.dsn ?? "";
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
