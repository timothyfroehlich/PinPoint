import type React from "react";
import { redirect } from "next/navigation";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { createClient } from "~/lib/supabase/server";
import { getUserAccessLevel } from "~/lib/permissions/access";
import { getLoginUrl } from "~/lib/login-url";
import { approveConsentAction, denyConsentAction } from "./actions";
import { authorizationIdSchema } from "./schemas";

/**
 * Supabase OAuth 2.1 consent screen (PP-u4ab.5).
 *
 * Supabase's authorization server does not host a consent UI — it redirects the
 * user to `Site URL + Authorization Path` (`/oauth/consent`) and expects the app
 * to display the request and call approve/deny. This is the final piece that
 * makes the MCP remote-admin OAuth handshake (PR #1707) complete.
 *
 * Admin-only for v1 (technician+ access tracked in PP-u4ab.6).
 */
export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}): Promise<React.JSX.Element> {
  const { authorization_id } = await searchParams;

  const parsedId = authorizationIdSchema.safeParse(authorization_id);
  if (!parsedId.success) {
    return (
      <ConsentNotice
        title="Invalid authorization request"
        body="This link is missing or has a malformed authorization request. Start the connection again from your client."
      />
    );
  }
  const authorizationId = parsedId.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      getLoginUrl(
        `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`
      )
    );
  }

  const accessLevel = await getUserAccessLevel(user.id);
  if (accessLevel !== "admin") {
    return (
      <ConsentNotice
        title="Admin access required"
        body="Connecting an application to PinPoint is limited to administrators. If you believe you should have access, contact an admin."
      />
    );
  }

  const { data, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

  if (error) {
    return (
      <ConsentNotice
        title="Couldn't load this request"
        body="This authorization request has expired or is no longer valid. Start the connection again from your client."
      />
    );
  }

  // Already consented (auto-approved) — Supabase hands back a ready redirect.
  if (!("authorization_id" in data)) {
    redirect(data.redirect_url);
  }

  // Defense in depth: the authorization must belong to the signed-in user.
  // Supabase scopes getAuthorizationDetails to the caller's session, so this
  // guards against ever rendering an approve form for someone else's request.
  if (data.user.id !== user.id) {
    return (
      <ConsentNotice
        title="Couldn't load this request"
        body="This authorization request doesn't belong to your account. Start the connection again from your client."
      />
    );
  }

  const { client, scope, redirect_uri } = data;
  const scopes = scope.split(" ").filter(Boolean);

  return (
    <Card className="border-border/70 bg-card/90 shadow-lg">
      <CardHeader className="space-y-3">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck aria-hidden="true" className="size-6" />
        </div>
        <CardTitle className="text-2xl font-bold text-foreground">
          Authorize {client.name}
        </CardTitle>
        <CardDescription>
          <span className="font-medium text-foreground">{client.name}</span> is
          requesting access to your PinPoint admin account. Only approve
          applications you trust.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <dl className="space-y-4 text-sm">
          {scopes.length > 0 && (
            <div className="space-y-1">
              <dt className="text-xs font-medium text-muted-foreground">
                Requested access
              </dt>
              <dd>
                <ul className="flex flex-wrap gap-2">
                  {scopes.map((s) => (
                    <li
                      key={s}
                      className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          <div className="space-y-1">
            <dt className="text-xs font-medium text-muted-foreground">
              Redirects to
            </dt>
            <dd className="break-all font-mono text-xs text-muted-foreground">
              {redirect_uri}
            </dd>
          </div>
        </dl>

        <div className="space-y-3">
          <form action={approveConsentAction}>
            <input
              type="hidden"
              name="authorization_id"
              value={authorizationId}
            />
            <Button type="submit" size="lg" className="w-full">
              Authorize
            </Button>
          </form>
          <form action={denyConsentAction}>
            <input
              type="hidden"
              name="authorization_id"
              value={authorizationId}
            />
            <Button
              type="submit"
              variant="outline"
              size="lg"
              className="w-full"
            >
              Deny
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Terminal notice card (invalid request / not admin / expired). No consent
 * action is offered — the user has nothing productive to submit from here.
 */
function ConsentNotice({
  title,
  body,
}: {
  title: string;
  body: string;
}): React.JSX.Element {
  return (
    <Card className="border-border/70 bg-card/90 shadow-lg">
      <CardHeader className="space-y-3">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert aria-hidden="true" className="size-6" />
        </div>
        <CardTitle className="text-2xl font-bold text-foreground">
          {title}
        </CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
    </Card>
  );
}
