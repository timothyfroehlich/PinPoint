"use client";

import {
  Container,
  Typography,
  Card,
  CardContent,
  Box,
  CircularProgress,
  Alert,
  Chip,
  Button,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Breadcrumbs,
} from "@mui/material";
import {
  LocationOn,
  Games,
  Person,
  Schedule,
  Edit,
  Save,
  Cancel,
  Flag,
  CheckCircle,
  RadioButtonUnchecked,
  Settings,
} from "@mui/icons-material";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserAvatar } from "~/app/_components/user-avatar";
import { useCurrentUser } from "~/lib/hooks/use-current-user";
import { api } from "~/trpc/react";
import { IssueImageGallery } from "~/app/_components/issue-image-gallery";
import { IssueImageUpload, type IssueAttachment } from "~/app/_components/issue-image-upload";
import React from "react";

interface IssueDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function IssueDetailPage({ params }: IssueDetailPageProps) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(
    null,
  );
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    statusId: "",
    assigneeId: "",
  });
  const [commentForm, setCommentForm] = useState("");

  const { isAuthenticated } = useCurrentUser();

  // Resolve the params Promise
  useEffect(() => {
    void params.then(setResolvedParams);
  }, [params]);

  // Get issue details
  const {
    data: issue,
    isLoading: isLoadingIssue,
    error: issueError,
    refetch,
  } = api.issue.getById.useQuery(
    { id: resolvedParams?.id ?? "" },
    { enabled: !!resolvedParams?.id },
  );

  // Get issue statuses for edit form
  const { data: issueStatuses } = api.issueStatus.getAll.useQuery();

  // Get organization members for assignee dropdown
  const { data: members } = api.user.getAllInOrganization.useQuery();

  // Mutations
  const updateIssueMutation = api.issue.update.useMutation({
    onSuccess: () => {
      setEditDialogOpen(false);
      void refetch();
    },
  });

  const addCommentMutation = api.issue.addComment.useMutation({
    onSuccess: () => {
      setCommentForm("");
      void refetch();
    },
  });

  const deleteAttachmentMutation = api.issue.deleteAttachment.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  if (!resolvedParams || isLoadingIssue) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading issue...
        </Typography>
      </Container>
    );
  }

  if (issueError || !issue) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          Error loading issue: {issueError?.message ?? "Issue not found"}
        </Alert>
      </Container>
    );
  }

  const handleEditIssue = () => {
    setEditForm({
      title: issue.title,
      description: issue.description ?? "",
      statusId: issue.statusId,
      assigneeId: issue.assigneeId ?? "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveIssue = () => {
    updateIssueMutation.mutate({
      id: issue.id,
      title: editForm.title.trim() || undefined,
      description: editForm.description.trim() || undefined,
      statusId: editForm.statusId || undefined,
      assigneeId: editForm.assigneeId || undefined,
    });
  };

  const handleAddComment = () => {
    if (commentForm.trim()) {
      addCommentMutation.mutate({
        issueId: issue.id,
        content: commentForm.trim(),
      });
    }
  };

  const handleAttachmentUploadSuccess = (attachment: IssueAttachment) => {
    // Refresh issue data to show new attachment
    void refetch();
  };

  const handleAttachmentDeleteSuccess = (attachmentId: string) => {
    deleteAttachmentMutation.mutate({
      attachmentId,
    });
  };

  const getSeverityColor = (severity: string | null) => {
    switch (severity) {
      case "Critical":
        return "#d73a49";
      case "High":
        return "#f66a0a";
      case "Medium":
        return "#0969da";
      case "Low":
        return "#1a7f37";
      default:
        return "#656d76";
    }
  };

  const isOpen =
    issue.status.name !== "Resolved" && issue.status.name !== "Closed";
  const canEdit = isAuthenticated;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          href="/issues"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <Typography color="text.primary">Issues</Typography>
        </Link>
        <Typography color="text.secondary">
          #{issue.id.substring(0, 7)}
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 600, flexGrow: 1 }}
          >
            {issue.title}
          </Typography>
          <Typography variant="h6" color="text.secondary">
            #{issue.id.substring(0, 7)}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          {isOpen ? (
            <Chip
              icon={<RadioButtonUnchecked />}
              label="Open"
              sx={{
                backgroundColor: "success.main",
                color: "white",
                fontWeight: 600,
              }}
            />
          ) : (
            <Chip
              icon={<CheckCircle />}
              label="Closed"
              sx={{
                backgroundColor: "primary.main",
                color: "white",
                fontWeight: 600,
              }}
            />
          )}

          {issue.severity && (
            <Chip
              label={issue.severity}
              sx={{
                backgroundColor: getSeverityColor(issue.severity),
                color: "white",
                fontWeight: 600,
              }}
            />
          )}

          <Typography variant="body2" color="text.secondary">
            {issue.reporter ? (
              <>
                <strong>{issue.reporter.name ?? "Unknown"}</strong> opened this
                issue {new Date(issue.createdAt).toLocaleDateString()}
              </>
            ) : (
              <>
                opened anonymously{" "}
                {new Date(issue.createdAt).toLocaleDateString()}
              </>
            )}
            • {issue.comments.length} comment
            {issue.comments.length !== 1 ? "s" : ""}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 4 }}>
        {/* Main Content */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          {/* Issue Description */}
          <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
            <CardContent sx={{ p: 3 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  mb: 2,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  {issue.reporter ? (
                    <UserAvatar user={issue.reporter} size="medium" />
                  ) : (
                    <Person sx={{ fontSize: 40, color: "text.secondary" }} />
                  )}
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {issue.reporter?.name ?? "Anonymous"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(issue.createdAt).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
                {canEdit && (
                  <IconButton onClick={handleEditIssue} size="small">
                    <Edit />
                  </IconButton>
                )}
              </Box>

              {issue.description ? (
                <Typography
                  variant="body1"
                  sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}
                >
                  {issue.description}
                </Typography>
              ) : (
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ fontStyle: "italic" }}
                >
                  No description provided.
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Issue Attachments */}
          {issue.attachments && issue.attachments.length > 0 && (
            <IssueImageGallery 
              attachments={issue.attachments}
              title="Issue Photos"
            />
          )}

          {/* Comments */}
          <Box sx={{ mb: 3 }}>
            {issue.comments.map((comment) => (
              <Card
                key={comment.id}
                sx={{ mb: 2, border: "1px solid", borderColor: "divider" }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      mb: 2,
                    }}
                  >
                    <UserAvatar user={comment.author} size="medium" />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {comment.author.name ?? "Unknown"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(comment.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography
                    variant="body1"
                    sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}
                  >
                    {comment.content}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          {/* Add Comment */}
          {canEdit && (
            <Card sx={{ border: "1px solid", borderColor: "divider" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Add a comment
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  placeholder="Leave a comment"
                  value={commentForm}
                  onChange={(e) => setCommentForm(e.target.value)}
                  sx={{ mb: 2 }}
                />
                <Box
                  sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}
                >
                  {/* Image Upload */}
                  <Box sx={{ flexGrow: 1 }}>
                    <IssueImageUpload
                      issueId={issue.id}
                      onUploadSuccess={handleAttachmentUploadSuccess}
                      onDeleteSuccess={handleAttachmentDeleteSuccess}
                      maxAttachments={3}
                    />
                  </Box>
                  
                  {/* Submit Button */}
                  <Button
                    variant="contained"
                    onClick={handleAddComment}
                    disabled={
                      !commentForm.trim() || addCommentMutation.isPending
                    }
                    sx={{ minWidth: 100 }}
                  >
                    {addCommentMutation.isPending ? "Adding..." : "Submit"}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}
        </Box>

        {/* Sidebar */}
        <Box sx={{ width: 300, flexShrink: 0 }}>
          <Card sx={{ border: "1px solid", borderColor: "divider" }}>
            <CardContent sx={{ p: 3 }}>
              {canEdit && (
                <Box sx={{ mb: 3 }}>
                  <Button
                    variant="outlined"
                    startIcon={<Settings />}
                    onClick={handleEditIssue}
                    fullWidth
                    sx={{ mb: 2 }}
                  >
                    Edit Issue
                  </Button>
                </Box>
              )}

              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, mb: 1, color: "text.secondary" }}
                >
                  Assignees
                </Typography>
                {issue.assignee ? (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <UserAvatar user={issue.assignee} size="small" />
                    <Typography variant="body2">
                      {issue.assignee.name ?? "Unknown"}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No one assigned
                  </Typography>
                )}
              </Box>

              <Divider sx={{ mb: 3 }} />

              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, mb: 2, color: "text.secondary" }}
                >
                  Game Information
                </Typography>
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
                >
                  <Games sx={{ fontSize: 16, color: "text.secondary" }} />
                  <Typography variant="body2">
                    {issue.gameInstance.name}
                  </Typography>
                </Box>
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: "20px" }}
                  >
                    ({issue.gameInstance.gameTitle.name})
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <LocationOn sx={{ fontSize: 16, color: "text.secondary" }} />
                  <Typography variant="body2">
                    {issue.gameInstance.room.location.name}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ mb: 3 }} />

              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, mb: 2, color: "text.secondary" }}
                >
                  Timeline
                </Typography>
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
                >
                  <Schedule sx={{ fontSize: 16, color: "text.secondary" }} />
                  <Typography variant="body2">
                    Created {new Date(issue.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Flag sx={{ fontSize: 16, color: "text.secondary" }} />
                  <Typography variant="body2">
                    Updated {new Date(issue.updatedAt).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Edit Issue Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Issue</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 2 }}>
            <TextField
              label="Title"
              value={editForm.title}
              onChange={(e) =>
                setEditForm({ ...editForm, title: e.target.value })
              }
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={editForm.description}
              onChange={(e) =>
                setEditForm({ ...editForm, description: e.target.value })
              }
              fullWidth
              multiline
              rows={4}
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={editForm.statusId}
                onChange={(e) =>
                  setEditForm({ ...editForm, statusId: e.target.value })
                }
                label="Status"
              >
                {issueStatuses?.map((status) => (
                  <MenuItem key={status.id} value={status.id}>
                    {status.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Assignee</InputLabel>
              <Select
                value={editForm.assigneeId}
                onChange={(e) =>
                  setEditForm({ ...editForm, assigneeId: e.target.value })
                }
                label="Assignee"
              >
                <MenuItem value="">
                  <em>Unassigned</em>
                </MenuItem>
                {members?.map((member) => (
                  <MenuItem key={member.id} value={member.id}>
                    {member.name ?? "Unknown User"}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setEditDialogOpen(false)}
            startIcon={<Cancel />}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveIssue}
            variant="contained"
            startIcon={<Save />}
            disabled={updateIssueMutation.isPending}
          >
            {updateIssueMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
