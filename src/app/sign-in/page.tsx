"use client";

import { Google, Email } from "@mui/icons-material";
import {
  Box,
  Card,
  Typography,
  Button,
  Divider,
  Container,
  Alert,
  TextField,
} from "@mui/material";
import { signIn, getProviders } from "next-auth/react";
import { useEffect, useState } from "react";

import type { ProviderId } from "@auth/core/providers";

import { DevLoginCompact } from "~/app/_components/DevLoginCompact";

// Define the provider type based on NextAuth v5's actual interface
interface Provider {
  id: string;
  name: string;
  type: string;
  signinUrl: string;
  callbackUrl: string;
}

export default function SignInPage(): React.JSX.Element {
  const [providers, setProviders] = useState<Record<
    ProviderId,
    Provider
  > | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [emailSent, setEmailSent] = useState<boolean>(false);

  useEffect(() => {
    async function fetchProviders(): Promise<void> {
      try {
        const availableProviders = await getProviders();
        setProviders(availableProviders);
      } catch (err) {
        console.error("Failed to fetch providers:", err);
        setError("Failed to load authentication providers");
      }
    }
    void fetchProviders();
  }, []);

  async function handleSignIn(providerId: string): Promise<void> {
    try {
      setIsLoading(providerId);
      setError(null);

      const result = await signIn(providerId, {
        callbackUrl: "/dashboard",
        redirect: false,
      });

      if (result.error) {
        setError(`Authentication failed: ${result.error}`);
      } else if (result.ok) {
        // Redirect will happen automatically via NextAuth
        window.location.href = "/dashboard";
      }
    } catch (err) {
      console.error("Sign-in error:", err);
      setError("An unexpected error occurred during sign-in");
    } finally {
      setIsLoading(null);
    }
  }

  async function handleEmailSignIn(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!email) return;

    try {
      setIsLoading("email");
      setError(null);

      const result = await signIn("resend", {
        email,
        callbackUrl: "/dashboard",
        redirect: false,
      });

      if (result.error) {
        setError(`Failed to send magic link: ${result.error}`);
      } else {
        setEmailSent(true);
      }
    } catch (err) {
      console.error("Email sign-in error:", err);
      setError("Failed to send magic link. Please try again.");
    } finally {
      setIsLoading(null);
    }
  }

  function getProviderIcon(providerId: string): React.ReactNode {
    switch (providerId) {
      case "google":
        return <Google />;
      case "resend":
        return <Email />;
      default:
        return null;
    }
  }

  function getProviderLabel(provider: Provider): string {
    switch (provider.id) {
      case "google":
        return "Continue with Google";
      case "credentials":
        return provider.name || "Continue with Email";
      case "resend":
        return "Continue with Email";
      default:
        return `Continue with ${provider.name}`;
    }
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: 4,
        }}
      >
        <Card sx={{ p: 4, width: "100%" }}>
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Welcome to PinPoint
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Sign in to access your pinball machine management dashboard
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Magic Link Email Form */}
            {providers &&
              Object.values(providers).find((p) => p.id === "resend") && (
                <>
                  {emailSent ? (
                    <Alert severity="success">
                      Check your email! We've sent you a magic link to sign in.
                    </Alert>
                  ) : (
                    <Box
                      component="form"
                      onSubmit={(e) => {
                        void handleEmailSignIn(e);
                      }}
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      <TextField
                        type="email"
                        label="Email address"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                        }}
                        required
                        fullWidth
                        disabled={isLoading === "email"}
                        placeholder="Enter your email address"
                      />
                      <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        fullWidth
                        disabled={isLoading === "email" || !email}
                        startIcon={<Email />}
                        sx={{
                          py: 1.5,
                          textTransform: "none",
                          fontSize: "1rem",
                        }}
                      >
                        {isLoading === "email"
                          ? "Sending magic link..."
                          : "Send magic link"}
                      </Button>
                    </Box>
                  )}

                  <Divider sx={{ my: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      or
                    </Typography>
                  </Divider>
                </>
              )}

            {/* OAuth Providers */}
            {providers ? (
              Object.values(providers)
                .filter(
                  (provider) =>
                    provider.id !== "credentials" && provider.id !== "resend",
                ) // Show OAuth providers
                .map((provider) => (
                  <Button
                    key={provider.id}
                    variant="outlined"
                    size="large"
                    fullWidth
                    disabled={isLoading === provider.id}
                    startIcon={getProviderIcon(provider.id)}
                    onClick={() => {
                      void handleSignIn(provider.id);
                    }}
                    sx={{
                      py: 1.5,
                      textTransform: "none",
                      fontSize: "1rem",
                    }}
                  >
                    {isLoading === provider.id
                      ? "Signing in..."
                      : getProviderLabel(provider)}
                  </Button>
                ))
            ) : (
              <Button
                variant="outlined"
                size="large"
                fullWidth
                disabled
                sx={{ py: 1.5 }}
              >
                Loading authentication options...
              </Button>
            )}

            {/* Show credentials provider separately if available */}
            {providers &&
              Object.values(providers).find((p) => p.id === "credentials") && (
                <>
                  <Divider sx={{ my: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Development
                    </Typography>
                  </Divider>
                  <Button
                    variant="text"
                    size="large"
                    fullWidth
                    disabled={isLoading === "credentials"}
                    onClick={() => {
                      void handleSignIn("credentials");
                    }}
                    sx={{
                      py: 1.5,
                      textTransform: "none",
                      fontSize: "1rem",
                    }}
                  >
                    {isLoading === "credentials"
                      ? "Signing in..."
                      : getProviderLabel(
                          Object.values(providers).find(
                            (p) => p.id === "credentials",
                          ) ?? {
                            id: "credentials",
                            name: "Credentials",
                            type: "credentials",
                            signinUrl: "",
                            callbackUrl: "",
                          },
                        )}
                  </Button>
                </>
              )}
          </Box>

          <Box sx={{ mt: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              By signing in, you agree to our terms of service and privacy
              policy.
            </Typography>
          </Box>
        </Card>
      </Box>

      {/* Development quick login component */}
      <DevLoginCompact />
    </Container>
  );
}
