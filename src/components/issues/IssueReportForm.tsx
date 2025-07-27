"use client";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Link,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

import { api } from "~/trpc/react";

export interface IssueReportFormProps {
  machineId: string;
  showMachineContext?: boolean;
  onSuccess?: (issue: { id: string; title: string }) => void;
  className?: string;
}

export function IssueReportForm({
  machineId,
  onSuccess,
  className,
}: IssueReportFormProps): React.ReactElement {
  const router = useRouter();
  const { data: session } = useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Use public or authenticated endpoint based on session
  const publicCreateMutation = api.issue.core.publicCreate.useMutation({
    onSuccess: (data) => {
      setSubmitSuccess(true);
      setSubmitError(null);
      setTitle("");
      setDescription("");
      setReporterEmail("");
      onSuccess?.(data);
    },
    onError: (error) => {
      setSubmitError(error.message);
      setSubmitSuccess(false);
    },
  });

  const authenticatedCreateMutation = api.issue.core.create.useMutation({
    onSuccess: (data) => {
      setSubmitSuccess(true);
      setSubmitError(null);
      setTitle("");
      setDescription("");
      onSuccess?.(data);
    },
    onError: (error) => {
      setSubmitError(error.message);
      setSubmitSuccess(false);
    },
  });

  const isSubmitting =
    publicCreateMutation.isPending || authenticatedCreateMutation.isPending;

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setSubmitError(null);

    if (!title.trim()) {
      setSubmitError("Title is required");
      return;
    }

    if (session) {
      // Authenticated user - use authenticated endpoint
      authenticatedCreateMutation.mutate({
        title: title.trim(),
        description: description.trim() || undefined,
        machineId,
      });
    } else {
      // Anonymous user - use public endpoint
      publicCreateMutation.mutate({
        title: title.trim(),
        description: description.trim() || undefined,
        machineId,
        reporterEmail: reporterEmail.trim() || undefined,
      });
    }
  };

  const isAuthenticated = !!session;

  // Handle className properly for strictest TypeScript
  const cardProps: { className?: string } = {};
  if (className) {
    cardProps.className = className;
  }

  return (
    <Card {...cardProps}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Report an Issue
        </Typography>

        {/* Success Message */}
        {submitSuccess && (
          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Issue reported successfully!{" "}
              {!isAuthenticated &&
                reporterEmail &&
                "You'll receive an email when it's resolved."}
            </Typography>
          </Alert>
        )}

        {/* Error Message */}
        {submitError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {submitError}
          </Alert>
        )}

        {/* Form */}
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
          <TextField
            label="Issue Title"
            variant="outlined"
            fullWidth
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            placeholder="Briefly describe the issue"
            sx={{ mb: 2 }}
            slotProps={{
              htmlInput: { maxLength: 255 },
            }}
            helperText={`${String(title.length)}/255 characters`}
          />

          <TextField
            label="Description (Optional)"
            variant="outlined"
            fullWidth
            multiline
            rows={4}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
            placeholder="Provide more details about the issue"
            sx={{ mb: 2 }}
          />

          {/* Email field for anonymous users */}
          {!isAuthenticated && (
            <Box sx={{ mb: 2 }}>
              <TextField
                label="Email (Optional)"
                variant="outlined"
                fullWidth
                type="email"
                value={reporterEmail}
                onChange={(e) => {
                  setReporterEmail(e.target.value);
                }}
                placeholder="your.email@example.com"
                helperText={
                  <Typography variant="caption">
                    Enter your email to get notified when this issue is
                    resolved, or{" "}
                    <Link
                      href="/api/auth/signin"
                      onClick={(e) => {
                        e.preventDefault();
                        router.push("/api/auth/signin");
                      }}
                    >
                      sign in
                    </Link>{" "}
                    for full features
                  </Typography>
                }
              />
            </Box>
          )}

          <Box display="flex" gap={2} alignItems="center">
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting || !title.trim()}
              startIcon={
                isSubmitting ? <CircularProgress size={16} /> : undefined
              }
            >
              {isSubmitting ? "Submitting..." : "Report Issue"}
            </Button>

            {isAuthenticated && (
              <Typography variant="body2" color="text.secondary">
                Signed in as {session.user.name ?? session.user.email}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
