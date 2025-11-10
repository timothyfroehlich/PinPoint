import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { env } from "~/env";
import { shouldEnableDevFeatures } from "~/lib/environment";
import { logger } from "~/lib/logger";
import { checkSystemHealth } from "~/lib/dal/system-health";
import { createAdminClient, createClient } from "~/lib/supabase/server";

interface DiagnosticsResponse {
  environment: {
    nodeEnv: string;
    vercelEnv: string | undefined;
    devFeaturesEnabled: boolean;
  };
  supabase: {
    public: {
      urlHost: string | null;
      projectRef: string | null;
      publishableKey: { present: boolean; tail: string | null };
    };
    server: {
      urlHost: string | null;
      projectRef: string | null;
      secretKey: { present: boolean; tail: string | null };
    };
    matches: boolean | null;
  };
  database: {
    urlHost: string | null;
    directUrlHost: string | null;
    health: Awaited<ReturnType<typeof checkSystemHealth>>;
  };
  checks: {
    adminListUsers: {
      ok: boolean;
      totalUsersHint?: number;
      error?: string;
    };
    publicAuthProbe?: {
      attempted: boolean;
      ok: boolean;
      error?: string;
    };
  };
}

function safeHost(urlString: string | undefined): string | null {
  if (!urlString) return null;
  try {
    const u = new URL(urlString);
    return u.host;
  } catch {
    // Allow bare refs or hosts like abc.supabase.co
    if (/^[a-z0-9-]+\.[a-z0-9.-]+$/i.test(urlString)) return urlString;
    return null;
  }
}

function redactKey(
  value: string | undefined,
  tailLen = 6,
): {
  present: boolean;
  tail: string | null;
} {
  if (!value) return { present: false, tail: null };
  const tail = value.slice(-tailLen);
  return { present: true, tail };
}

function parseProjectRef(urlString: string | undefined): string | null {
  if (!urlString) return null;
  try {
    const u = new URL(
      urlString.includes("://") ? urlString : `https://${urlString}`,
    );
    const parts = u.hostname.split(".");
    const supabaseIdx = parts.findIndex((p) =>
      p.toLowerCase().includes("supabase"),
    );
    if (supabaseIdx > 0) return parts[supabaseIdx - 1] ?? null;
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Gate: only available when dev features are explicitly enabled
  if (!shouldEnableDevFeatures()) {
    return new NextResponse(null, { status: 404 });
  }

  const url = new URL(req.url);
  const deep =
    url.searchParams.get("deep") === "1" ||
    url.searchParams.get("deep") === "true";
  const probeAuth =
    deep ||
    url.searchParams.get("auth") === "1" ||
    url.searchParams.get("auth") === "true";

  // Gather environment basics
  const publicUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serverUrl = env.SUPABASE_URL;
  const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = env.SUPABASE_SECRET_KEY;
  const dbUrl = env.DATABASE_URL;
  const directUrl = env.DIRECT_URL;

  const derived = {
    publicHost: safeHost(publicUrl),
    serverHost: safeHost(serverUrl),
    publicRef: parseProjectRef(publicUrl),
    serverRef: parseProjectRef(serverUrl),
    dbHost: (() => {
      try {
        if (!dbUrl) return null;
        const u = new URL(dbUrl);
        return u.host;
      } catch {
        return null;
      }
    })(),
    directHost: (() => {
      try {
        if (!directUrl) return null;
        const u = new URL(directUrl);
        return u.host;
      } catch {
        return null;
      }
    })(),
  };

  const matches =
    derived.publicRef && derived.serverRef
      ? derived.publicRef === derived.serverRef
      : null;

  logger.info({
    msg: "[DEV-DIAG] Environment summary",
    component: "api.dev.diagnostics",
    context: {
      nodeEnv: env.NODE_ENV,
      vercelEnv: env.VERCEL_ENV ?? null,
      devFeaturesEnabled: shouldEnableDevFeatures(),
    },
  });

  logger.info({
    msg: "[DEV-DIAG] Supabase config",
    component: "api.dev.diagnostics",
    context: {
      publicHost: derived.publicHost,
      serverHost: derived.serverHost,
      publicRef: derived.publicRef,
      serverRef: derived.serverRef,
      refsMatch: matches,
      publishableKeyTail: redactKey(publicKey).tail,
      secretKeyTail: redactKey(secretKey).tail,
    },
  });

  // DB health
  const health = await checkSystemHealth();
  logger.info({
    msg: "[DEV-DIAG] DB health",
    component: "api.dev.diagnostics",
    context: { database: health.database, status: health.status },
  });

  // Admin check: can we hit Auth admin
  let adminOk = false;
  let adminTotalHint: number | undefined;
  let adminErr: string | undefined;
  try {
    const admin = await createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    if (error) throw error as unknown as Error;
    adminOk = true;
    adminTotalHint = Array.isArray(data.users) ? data.users.length : 0;
  } catch (e) {
    adminOk = false;
    adminErr = e instanceof Error ? e.message : String(e);
    logger.error({
      msg: "[DEV-DIAG] Admin list users failed",
      component: "api.dev.diagnostics",
      error: { message: adminErr },
    });
  }

  // Optional public auth sign-in probe using known dev user
  let authProbe: DiagnosticsResponse["checks"]["publicAuthProbe"] | undefined;
  if (probeAuth) {
    const testEmail = "harry.williams@example.com"; // seeded member user
    const testPassword = "dev-login-123"; // seeded by scripts/create-dev-users.ts
    try {
      // Use SSR-safe client per CORE-SSR-001
      const sb = await createClient();
      const { error } = await sb.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
      if (error) throw error as unknown as Error;
      // Sign out regardless to avoid lingering sessions
      await sb.auth.signOut();
      authProbe = { attempted: true, ok: true };
      logger.info({
        msg: "[DEV-DIAG] Public sign-in probe succeeded",
        component: "api.dev.diagnostics",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      authProbe = { attempted: true, ok: false, error: message };
      logger.error({
        msg: "[DEV-DIAG] Public sign-in probe failed",
        component: "api.dev.diagnostics",
        error: { message },
      });
    }
  }

  const adminListUsers: DiagnosticsResponse["checks"]["adminListUsers"] =
    adminOk
      ? {
          ok: true,
          ...(typeof adminTotalHint === "number"
            ? { totalUsersHint: adminTotalHint }
            : {}),
        }
      : { ok: false, ...(adminErr ? { error: adminErr } : {}) };

  const checks: DiagnosticsResponse["checks"] = {
    adminListUsers,
    ...(authProbe ? { publicAuthProbe: authProbe } : {}),
  } as DiagnosticsResponse["checks"]; // cast constrained by conditional construction

  const body: DiagnosticsResponse = {
    environment: {
      nodeEnv: env.NODE_ENV,
      vercelEnv: env.VERCEL_ENV,
      devFeaturesEnabled: shouldEnableDevFeatures(),
    },
    supabase: {
      public: {
        urlHost: derived.publicHost,
        projectRef: derived.publicRef,
        publishableKey: redactKey(publicKey),
      },
      server: {
        urlHost: derived.serverHost,
        projectRef: derived.serverRef,
        secretKey: redactKey(secretKey),
      },
      matches,
    },
    database: {
      urlHost: derived.dbHost,
      directUrlHost: derived.directHost,
      health,
    },
    checks,
  };

  return NextResponse.json(body, { status: 200 });
}
