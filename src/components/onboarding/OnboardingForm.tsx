"use client";

import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

import { api } from "~/trpc/react";

interface OnboardingFormProps {
  organizationName?: string;
  inviterName?: string;
  isInvited?: boolean;
}

export function OnboardingForm({
  organizationName = "this organization",
  inviterName,
  isInvited = false,
}: OnboardingFormProps): React.JSX.Element {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { data: session, update: updateSession } = useSession();

  const updateUser = api.user.updateProfile.useMutation({
    onSuccess: async () => {
      // Update the session to reflect onboarding completion
      await updateSession();
      // Redirect to dashboard
      router.push("/dashboard");
    },
    onError: (err) => {
      setError(err.message);
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await updateUser.mutateAsync({
        name: name.trim(),
        onboardingCompleted: true,
      });
    } catch (err) {
      // Error handling is done in onError callback
      console.error("Onboarding error:", err);
    }
  };

  const welcomeMessage =
    isInvited && inviterName
      ? `${inviterName} invited you to join ${organizationName}!`
      : `Welcome to ${organizationName}!`;

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
              🎯 Welcome to PinPoint!
            </Typography>
            <Typography variant="h6" color="primary" gutterBottom>
              {welcomeMessage}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Just a few quick details to get you started
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            sx={{ display: "flex", flexDirection: "column", gap: 3 }}
          >
            <TextField
              label="Full Name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              required
              fullWidth
              disabled={isSubmitting}
              placeholder="Enter your full name"
              autoFocus
            />

            <TextField
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
              }}
              fullWidth
              disabled={isSubmitting}
              placeholder="For important notifications"
              helperText="Optional - We'll only use this for urgent machine alerts"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={emailNotifications}
                  onChange={(e) => {
                    setEmailNotifications(e.target.checked);
                  }}
                  disabled={isSubmitting}
                />
              }
              label="I'd like to receive email notifications about machine issues"
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting || !name.trim()}
              sx={{ mt: 2 }}
            >
              {isSubmitting ? "Setting up your account..." : "Get Started"}
            </Button>
          </Box>

          <Box sx={{ mt: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              You're signed in as {session?.user.email}
            </Typography>
          </Box>
        </Card>
      </Box>
    </Container>
  );
}
