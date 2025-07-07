"use client";

import {
  Typography,
  Card,
  CardContent,
  Box,
  Grid,
  Alert,
  CircularProgress,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from "@mui/material";
import { Person, BugReport } from "@mui/icons-material";
import { useState } from "react";
import React from "react";
import { useCurrentUser } from "~/lib/hooks/use-current-user";
import { api } from "~/trpc/react";
import {
  IssueImageUpload,
  type IssueAttachment,
} from "~/app/_components/issue-image-upload";

type GameInstance = {
  id: string;
  name: string;
  gameTitle: {
    name: string;
  };
};

interface IssueSubmissionFormProps {
  gameInstances: GameInstance[];
  onSuccess?: () => void;
}

export function IssueSubmissionForm({
  gameInstances,
  onSuccess,
}: IssueSubmissionFormProps) {
  const [issueForm, setIssueForm] = useState({
    gameInstanceId: "",
    title: "",
    severity: "" as "Low" | "Medium" | "High" | "Critical" | "",
    description: "",
    reporterEmail: "",
  });
  const [issueAttachments, setIssueAttachments] = useState<IssueAttachment[]>(
    [],
  );

  const { user, isAuthenticated } = useCurrentUser();

  const createIssueMutation = api.issue.create.useMutation({
    onSuccess: async (newIssue) => {
      if (issueAttachments.length > 0) {
        try {
          for (const attachment of issueAttachments) {
            if (attachment.file) {
              const formData = new FormData();
              formData.append("file", attachment.file);
              formData.append("issueId", newIssue.id);

              await fetch("/api/upload/issue", {
                method: "POST",
                body: formData,
              });
            }
          }
        } catch (error) {
          console.error("Error uploading attachments:", error);
        }
      }

      setIssueForm({
        gameInstanceId: "",
        title: "",
        severity: "",
        description: "",
        reporterEmail: "",
      });
      setIssueAttachments([]);
      onSuccess?.();
    },
  });

  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueForm.gameInstanceId || !issueForm.title.trim()) return;

    createIssueMutation.mutate({
      title: issueForm.title.trim(),
      description: issueForm.description.trim() || undefined,
      severity: issueForm.severity || undefined,
      reporterEmail: !isAuthenticated
        ? issueForm.reporterEmail.trim() || undefined
        : undefined,
      gameInstanceId: issueForm.gameInstanceId,
    });
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <BugReport color="primary" />
          <Typography variant="h6">Report an Issue</Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />

        {gameInstances.length === 0 ? (
          <Alert severity="info">
            No games available to report issues for.
          </Alert>
        ) : (
          <Box
            component="form"
            onSubmit={handleIssueSubmit}
            sx={{ display: "flex", flexDirection: "column", gap: 3 }}
          >
            <FormControl fullWidth>
              <InputLabel>Game *</InputLabel>
              <Select
                value={issueForm.gameInstanceId}
                onChange={(e) =>
                  setIssueForm({
                    ...issueForm,
                    gameInstanceId: e.target.value,
                  })
                }
                label="Game *"
                required
              >
                <MenuItem value="">
                  <em>Select a game...</em>
                </MenuItem>
                {gameInstances.map((instance) => (
                  <MenuItem key={instance.id} value={instance.id}>
                    {instance.name} ({instance.gameTitle.name})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  fullWidth
                  label="Issue Title *"
                  value={issueForm.title}
                  onChange={(e) =>
                    setIssueForm({ ...issueForm, title: e.target.value })
                  }
                  placeholder="Brief description of the problem"
                  inputProps={{ maxLength: 255 }}
                  helperText={`${issueForm.title.length}/255 characters`}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Severity</InputLabel>
                  <Select
                    value={issueForm.severity}
                    onChange={(e) =>
                      setIssueForm({
                        ...issueForm,
                        severity: e.target.value as
                          | "Low"
                          | "Medium"
                          | "High"
                          | "Critical"
                          | "",
                      })
                    }
                    label="Severity"
                  >
                    <MenuItem value="">
                      <em>Select severity...</em>
                    </MenuItem>
                    <MenuItem value="Low">Low</MenuItem>
                    <MenuItem value="Medium">Medium</MenuItem>
                    <MenuItem value="High">High</MenuItem>
                    <MenuItem value="Critical">Critical</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <TextField
              fullWidth
              label="Description"
              value={issueForm.description}
              onChange={(e) =>
                setIssueForm({
                  ...issueForm,
                  description: e.target.value,
                })
              }
              placeholder="Detailed description of the issue..."
              multiline
              rows={3}
              inputProps={{ maxLength: 1000 }}
              helperText={`${issueForm.description.length}/1000 characters`}
            />

            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Add Photos (Optional)
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Upload up to 3 photos to help illustrate the issue
              </Typography>
              <IssueImageUpload
                attachments={issueAttachments}
                onAttachmentsChange={setIssueAttachments}
                maxAttachments={3}
                disabled={createIssueMutation.isPending}
              />
            </Box>

            {isAuthenticated ? (
              <Alert
                severity="info"
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <Person />
                Reporting as:{" "}
                {user?.name ?? user?.email ?? "Authenticated User"}
              </Alert>
            ) : (
              <TextField
                fullWidth
                label="Get notified for updates? (Optional)"
                type="email"
                value={issueForm.reporterEmail}
                onChange={(e) =>
                  setIssueForm({
                    ...issueForm,
                    reporterEmail: e.target.value,
                  })
                }
                placeholder="Email address"
                helperText="Leave blank to report anonymously"
              />
            )}

            <Box
              sx={{
                display: "flex",
                gap: 2,
                justifyContent: "flex-start",
              }}
            >
              <Button
                type="submit"
                variant="contained"
                disabled={
                  !issueForm.gameInstanceId ||
                  !issueForm.title.trim() ||
                  createIssueMutation.isPending
                }
                sx={{ minWidth: 140 }}
              >
                {createIssueMutation.isPending ? (
                  <CircularProgress size={24} />
                ) : (
                  "Submit Issue"
                )}
              </Button>

              <Button
                type="button"
                variant="outlined"
                onClick={() => {
                  setIssueForm({
                    gameInstanceId: "",
                    title: "",
                    severity: "",
                    description: "",
                    reporterEmail: "",
                  });
                  setIssueAttachments([]);
                }}
                disabled={createIssueMutation.isPending}
              >
                Clear Form
              </Button>
            </Box>

            {createIssueMutation.isSuccess && (
              <Alert severity="success">
                Issue submitted successfully! It will be reviewed by the staff.
              </Alert>
            )}

            {createIssueMutation.error && (
              <Alert severity="error">
                Error submitting issue: {createIssueMutation.error.message}
              </Alert>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
