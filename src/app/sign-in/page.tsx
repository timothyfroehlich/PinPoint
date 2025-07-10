"use client";

import { useEffect, useState } from "react";
import { signIn, getProviders } from "next-auth/react";
import { type User, type Role } from "@prisma/client";
import { useCurrentUser } from "~/lib/hooks/use-current-user";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Typography,
  Paper,
  Chip,
  Container,
  Stack,
  Divider,
} from "@mui/material";
import { Google } from "@mui/icons-material";
import { env } from "~/env.js";

type UserWithRole = User & { role: Role | null };

export default function SignInPage() {
  const { isAuthenticated } = useCurrentUser();
  const router = useRouter();
  const [providers, setProviders] = useState<Record<string, unknown> | null>(
    null,
  );
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
      return;
    }

    async function getProvidersData() {
      const providersData = await getProviders();
      setProviders(providersData);
    }

    void getProvidersData();
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (env.NEXT_PUBLIC_NODE_ENV === "development") {
      async function fetchTestUsers() {
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

  async function handleGoogleSignIn() {
    setIsLoading(true);
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch (error) {
      console.error("Google sign in failed:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDevLogin(email: string) {
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        redirect: false,
      });

      console.log("Sign-in result:", result);

      if (result?.ok) {
        // Redirect manually on success
        window.location.href = "/";
      } else {
        console.error("Sign-in failed:", result?.error);
      }
    } catch (error) {
      console.error("Dev login failed:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function getRoleColor(
    role: Role | null,
  ):
    | "default"
    | "primary"
    | "secondary"
    | "error"
    | "info"
    | "success"
    | "warning" {
    switch (role) {
      case "admin":
        return "error";
      case "member":
        return "primary";
      case "player":
        return "success";
      default:
        return "default";
    }
  }

  if (isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Sign In to PinPoint
        </Typography>

        <Typography
          variant="body1"
          align="center"
          color="text.secondary"
          sx={{ mb: 4 }}
        >
          Welcome back! Please sign in to continue.
        </Typography>

        <Stack spacing={3}>
          {providers && "google" in providers && (
            <Button
              variant="contained"
              size="large"
              startIcon={<Google />}
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              fullWidth
              sx={{ py: 1.5 }}
            >
              Sign in with Google
            </Button>
          )}

          {env.NEXT_PUBLIC_NODE_ENV === "development" && (
            <>
              <Divider sx={{ my: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Development Mode
                </Typography>
              </Divider>

              <Box>
                <Typography variant="body1" gutterBottom>
                  Quick Login (Dev Only)
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  Skip authentication and login as a test user
                </Typography>

                <Stack spacing={1}>
                  {isLoadingUsers ? (
                    <Typography variant="body2" color="text.secondary">
                      Loading test users...
                    </Typography>
                  ) : (
                    users.map((testUser) => (
                      <Box
                        key={testUser.id}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          p: 0.5,
                          border: 1,
                          borderColor: "divider",
                          borderRadius: 1,
                        }}
                      >
                        <Button
                          variant="outlined"
                          size="small"
                          disabled={isLoading}
                          onClick={() =>
                            void handleDevLogin(testUser.email ?? "")
                          }
                          sx={{
                            justifyContent: "flex-start",
                            textTransform: "none",
                            flex: 1,
                            fontSize: "0.75rem",
                            py: 0.5,
                          }}
                        >
                          {testUser.name}
                        </Button>
                        {testUser.role && (
                          <Chip
                            label={testUser.role.toUpperCase()}
                            size="small"
                            color={getRoleColor(testUser.role)}
                            sx={{ fontSize: "0.6rem", height: "18px" }}
                          />
                        )}
                      </Box>
                    ))
                  )}
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
