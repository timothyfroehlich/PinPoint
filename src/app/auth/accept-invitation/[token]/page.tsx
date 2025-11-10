/**
 * Invitation Acceptance Page
 *
 * Handles acceptance of user invitations via secure token.
 * Different flows for existing vs new users.
 */

import { redirect } from "next/navigation";
import { hashToken, isValidTokenFormat } from "~/lib/utils/invitation-tokens";
import {
  findPendingInvitationByTokenHash,
  findUserByEmailAddress,
  markInvitationAccepted,
  markInvitationExpired,
  verifyUserEmail,
} from "~/lib/services/invitations";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { CheckCircle, AlertCircle, XCircle, Clock } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function AcceptInvitationPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { token } = await params;

  // Validate token format
  if (!isValidTokenFormat(token)) {
    return <InvalidTokenError message="Invalid invitation token format" />;
  }

  // Hash the token for database lookup
  const tokenHash = hashToken(token);

  try {
    // Find invitation by token hash
    const invitation = await findPendingInvitationByTokenHash(tokenHash);

    if (!invitation) {
      return (
        <InvalidTokenError message="Invitation not found, already used, or has been cancelled" />
      );
    }

    // Check if invitation has expired
    const now = new Date();
    if (invitation.expiresAt < now) {
      await markInvitationExpired(invitation.id);
      return <ExpiredInvitationError invitation={invitation} />;
    }

    // Check if user exists and is verified
    const existingUser = await findUserByEmailAddress(invitation.email);

    if (existingUser?.emailVerified) {
      // Existing verified user - auto-accept and redirect
      await acceptInvitation(invitation.id, existingUser.id);

      // Redirect to organization dashboard
      const orgPath = invitation.organization.subdomain
        ? `/${invitation.organization.subdomain}`
        : "";

      redirect(`${orgPath}/dashboard`);
    }

    // New user or unverified user - show acceptance flow
    return (
      <AcceptInvitationFlow
        invitation={invitation}
        existingUser={existingUser}
        token={token}
      />
    );
  } catch (error) {
    console.error("Invitation acceptance error:", error);
    const errorMessage = error instanceof Error ? error.message : undefined;
    return (
      <InvalidTokenError
        message="An error occurred while processing your invitation"
        {...(errorMessage && { error: errorMessage })}
      />
    );
  }
}

/**
 * Accept invitation and update status
 */
async function acceptInvitation(
  invitationId: string,
  userId: string,
): Promise<void> {
  await Promise.all([
    markInvitationAccepted(invitationId),
    verifyUserEmail(userId),
  ]);
}

/**
 * Acceptance flow component for new/unverified users
 */
function AcceptInvitationFlow({
  invitation,
  existingUser,
  token,
}: {
  invitation: {
    email: string;
    organization: {
      id: string;
      name: string;
      subdomain: string | null;
    };
    role: {
      name: string;
    };
    expiresAt: Date;
  };
  existingUser?: {
    id: string;
    email: string | null;
    emailVerified: Date | null;
  } | null | undefined;
  token: string;
}): React.JSX.Element {
  const isNewUser = !existingUser;
  const expiresFormatted = invitation.expiresAt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="container flex items-center justify-center min-h-screen py-8">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-r from-primary to-primary-container rounded-full flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">You've Been Invited!</CardTitle>
          <CardDescription>
            Join {invitation.organization.name} on PinPoint
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="space-y-3 p-4 bg-accent rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Organization</p>
              <p className="font-medium">{invitation.organization.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your Role</p>
              <p className="font-medium">{invitation.role.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{invitation.email}</p>
            </div>
            <div className="flex items-center text-sm text-muted-foreground pt-2 border-t">
              <Clock className="h-4 w-4 mr-2" />
              <span>Expires {expiresFormatted}</span>
            </div>
          </div>

          {/* Action */}
          {isNewUser ? (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>New User</AlertTitle>
                <AlertDescription>
                  We'll create an account for you. Click the button below to
                  complete your signup.
                </AlertDescription>
              </Alert>
              <Button asChild className="w-full" size="lg">
                <Link
                  href={`/auth/signup?invitation=${token}&email=${encodeURIComponent(invitation.email)}`}
                >
                  Complete Signup
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Email Verification Required</AlertTitle>
                <AlertDescription>
                  Your account exists but your email needs to be verified.
                  Please sign in to accept this invitation.
                </AlertDescription>
              </Alert>
              <Button asChild className="w-full" size="lg">
                <Link
                  href={`/auth/login?invitation=${token}&email=${encodeURIComponent(invitation.email)}`}
                >
                  Sign In to Accept
                </Link>
              </Button>
            </>
          )}

          {/* Help Text */}
          <p className="text-xs text-center text-muted-foreground">
            By continuing, you agree to join {invitation.organization.name} with
            the role of {invitation.role.name}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Invalid token error component
 */
function InvalidTokenError({
  message,
  error,
}: {
  message: string;
  error?: string;
}): React.JSX.Element {
  return (
    <div className="container flex items-center justify-center min-h-screen py-8">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle>Invalid Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>

          {error && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Technical Details</summary>
              <pre className="mt-2 p-2 bg-muted rounded overflow-auto">
                {error}
              </pre>
            </details>
          )}

          <div className="text-center space-y-2 pt-4">
            <p className="text-sm text-muted-foreground">
              This invitation link may have already been used, cancelled, or is
              invalid.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/auth/login">Go to Login</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Expired invitation error component
 */
function ExpiredInvitationError({
  invitation,
}: {
  invitation: {
    organization: {
      name: string;
    };
  };
}): React.JSX.Element {
  return (
    <div className="container flex items-center justify-center min-h-screen py-8">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-warning/20 rounded-full flex items-center justify-center">
            <Clock className="h-8 w-8 text-warning" />
          </div>
          <CardTitle>Invitation Expired</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Expired</AlertTitle>
            <AlertDescription>
              This invitation to join {invitation.organization.name} has
              expired.
            </AlertDescription>
          </Alert>

          <div className="text-center space-y-2 pt-4">
            <p className="text-sm text-muted-foreground">
              Please contact an administrator of {invitation.organization.name}{" "}
              to request a new invitation.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/auth/login">Go to Login</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
