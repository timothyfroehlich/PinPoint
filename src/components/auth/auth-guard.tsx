import Link from "next/link";
import { Button } from "~/components/ui/button";
import type { AuthContext } from "~/server/auth/context";

interface AuthGuardProps {
  authContext: AuthContext;
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

export function AuthGuard({
  authContext,
  children,
  fallbackTitle = "Authentication Required",
  fallbackMessage = "You need to be signed in as a member to view this content.",
}: AuthGuardProps): React.JSX.Element {
  if (authContext.kind !== "authorized") {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">{fallbackTitle}</h1>
          <p className="text-muted-foreground mb-6">{fallbackMessage}</p>
          <Button asChild>
            <Link href="/auth/sign-in">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
