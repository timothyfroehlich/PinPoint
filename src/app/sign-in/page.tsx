"use client";

import { type InferSelectModel } from "drizzle-orm";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Chrome, Loader2 } from "lucide-react";

import { useAuth } from "~/app/auth-provider";
import { authenticateDevUser, getAuthResultMessage } from "~/lib/auth/dev-auth";
import { isDevAuthAvailable } from "~/lib/environment-client";
import { createClient } from "~/utils/supabase/client";
import type { users, roles } from "~/server/db/schema";

type User = InferSelectModel<typeof users>;
type Role = InferSelectModel<typeof roles>;
type UserWithRole = User & { role: Role | null };

// Check if dev features are available
const shouldShowDevLogin = isDevAuthAvailable();

export default function SignInPage(): React.ReactElement | null {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const isAuthenticated = !loading && !!user;

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
      return;
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (shouldShowDevLogin) {
      async function fetchTestUsers(): Promise<void> {
        setIsLoadingUsers(true);
        try {
          const res = await fetch("/api/dev/users");
          if (!res.ok) {
            console.error(
              "Failed to fetch dev users:",
              res.status,
              res.statusText,
            );
            return;
          }
          const { users } = (await res.json()) as { users: UserWithRole[] };
          setUsers(users);
        } catch (error) {
          console.error("Error fetching dev users:", error);
        } finally {
          setIsLoadingUsers(false);
        }
      }

      void fetchTestUsers();
    }
  }, []);

  async function handleGoogleSignIn(): Promise<void> {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) {
        console.error("Google sign in failed:", error.message);
      }
    } catch (error) {
      console.error("Google sign in failed:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDevLogin(email: string): Promise<void> {
    setIsLoading(true);
    try {
      console.log("Dev immediate login as:", email);

      // Find the user to get their role
      const testUser = users.find((u) => u.email === email);
      const supabase = createClient();

      const userData: { email: string; name?: string; role?: string } = {
        email,
      };
      if (testUser?.name) userData.name = testUser.name;
      if (testUser?.role?.name) userData.role = testUser.role.name;

      const result = await authenticateDevUser(supabase as any, userData);

      const message = getAuthResultMessage(result);

      if (result.success) {
        console.log("Dev login successful:", result.method);
        alert(message);
        // Refresh the page to update auth state
        window.location.reload();
      } else {
        console.error("Login failed:", result.error);
        alert(message);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Dev login failed:", errorMessage);
      alert(`Login failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }

  function getRoleBadgeVariant(role: Role | null): "default" | "secondary" | "destructive" | "outline" {
    if (!role) return "default";
    switch (role.name.toLowerCase()) {
      case "admin":
        return "destructive";
      case "member":
        return "default";
      case "player":
        return "secondary";
      default:
        return "outline";
    }
  }

  if (isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="container mx-auto max-w-sm mt-32">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Sign In to PinPoint</CardTitle>
          <CardDescription className="text-lg">
            Welcome back! Please sign in to continue.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Button
            className="w-full h-12"
            onClick={() => void handleGoogleSignIn()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Chrome className="mr-2 h-4 w-4" />
            )}
            Sign in with Google
          </Button>

          {shouldShowDevLogin && (
            <>
              <div className="relative">
                <Separator />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-background px-2 text-sm text-muted-foreground">
                    Development Mode
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-medium">Quick Login (Dev Only)</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Skip authentication and login as a test user
                  </p>
                </div>

                <div className="space-y-2">
                  {isLoadingUsers ? (
                    <p className="text-sm text-muted-foreground">
                      Loading test users...
                    </p>
                  ) : (
                    users.map((testUser) => (
                      <div
                        key={testUser.id}
                        className="flex items-center gap-2 p-2 border rounded-md"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isLoading}
                          onClick={() => void handleDevLogin(testUser.email ?? "")}
                          className="flex-1 justify-start text-xs h-8"
                        >
                          {testUser.name}
                        </Button>
                        {testUser.role && (
                          <Badge 
                            variant={getRoleBadgeVariant(testUser.role)}
                            className="text-xs h-5"
                          >
                            {testUser.role.name.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
