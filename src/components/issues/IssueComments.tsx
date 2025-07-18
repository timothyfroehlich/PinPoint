"use client";

import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Stack,
  Avatar,
  Chip,
  FormControlLabel,
  Switch,
  Alert,
  Divider,
} from "@mui/material";
import { type Session } from "next-auth";
import { useState } from "react";

import { api } from "~/trpc/react";
import { type IssueWithDetails, type Comment } from "~/types/issue";

interface IssueCommentsProps {
  issue: IssueWithDetails;
  session: Session | null;
  hasPermission: (permission: string) => boolean;
  onError: (error: string) => void;
}

export function IssueComments({
  issue,
  session,
  hasPermission,
  onError,
}: IssueCommentsProps) {
  const [commentText, setCommentText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const utils = api.useUtils();
  const createComment = api.issue.comment.addComment.useMutation({
    onSuccess: () => {
      setCommentText("");
      setIsInternal(false);
      utils.issue.core.getById.invalidate({ id: issue.id });
    },
    onError: (error) => {
      onError(error.message);
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;

    setIsSubmitting(true);
    createComment.mutate({
      issueId: issue.id,
      content: commentText,
      isInternal,
    });
  };

  const isAuthenticated = !!session?.user;
  const canComment = hasPermission("issues:comment");
  const canViewInternal = hasPermission("issues:read_internal");
  const canCreateInternal = hasPermission("issues:comment_internal");

  // Filter comments based on permissions
  const visibleComments =
    issue.comments?.filter((comment: Comment) => {
      if (!comment.isInternal) return true; // Public comments are always visible
      return canViewInternal; // Internal comments only visible with permission
    }) || [];

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Comments
      </Typography>

      {/* Comments List */}
      <Box data-testid="public-comments" sx={{ mb: 3 }}>
        {visibleComments.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No comments yet.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {visibleComments.map((comment: Comment, index: number) => (
              <Paper
                key={comment.id}
                variant="outlined"
                sx={{ p: 2 }}
                data-testid={
                  index === visibleComments.length - 1
                    ? "latest-comment"
                    : undefined
                }
              >
                <Stack direction="row" spacing={2}>
                  <Avatar sx={{ width: 32, height: 32 }}>
                    {comment.author.name?.[0] || "?"}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{ mb: 1 }}
                    >
                      <Typography variant="subtitle2">
                        {comment.author.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </Typography>
                      {comment.isInternal ? (
                        <Chip
                          label="Internal"
                          size="small"
                          color="warning"
                          variant="outlined"
                          data-testid="internal-comment-badge"
                        />
                      ) : (
                        <Chip
                          label="Public"
                          size="small"
                          color="primary"
                          variant="outlined"
                          data-testid="public-badge"
                        />
                      )}
                    </Stack>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {comment.content}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Box>

      {/* Comment Form */}
      {isAuthenticated && canComment && (
        <Box data-testid="comment-form">
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle1" gutterBottom>
            Add Comment
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={3}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write your comment..."
            disabled={isSubmitting}
            data-testid="comment-textarea"
            sx={{ mb: 2 }}
          />

          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box>
              {canCreateInternal && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      disabled={isSubmitting}
                      data-testid="internal-comment-toggle"
                    />
                  }
                  label="Internal comment"
                />
              )}
            </Box>

            <Button
              variant="contained"
              onClick={handleSubmitComment}
              disabled={!commentText.trim() || isSubmitting}
              data-testid="submit-comment-button"
            >
              {isSubmitting ? "Posting..." : "Post Comment"}
            </Button>
          </Stack>
        </Box>
      )}

      {/* Add Comment Button (for mobile/compact view) */}
      {isAuthenticated && !canComment && (
        <Box data-testid="no-comment-permission">
          <Alert severity="info">
            You need comment permissions to add comments
          </Alert>
        </Box>
      )}

      {isAuthenticated && canComment && (
        <Box sx={{ display: { xs: "block", md: "none" }, mt: 2 }}>
          <Button
            variant="outlined"
            fullWidth
            data-testid="add-comment-button"
            onClick={() => {
              // Scroll to comment form or show modal on mobile
              const commentForm = document.querySelector(
                '[data-testid="comment-form"]',
              );
              commentForm?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Add Comment
          </Button>
        </Box>
      )}
    </Box>
  );
}
