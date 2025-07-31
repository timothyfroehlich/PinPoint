"use client";

import {
  Box,
  Typography,
  TextField,
  Paper,
  Stack,
  Avatar,
  Alert,
  Divider,
} from "@mui/material";
import { useState } from "react";

import type { PinPointSupabaseUser } from "../../../lib/supabase/types";

import { PermissionButton, PermissionGate } from "~/components/permissions";
import { api } from "~/trpc/react";
import { type IssueWithDetails, type Comment } from "~/types/issue";

interface IssueCommentsProps {
  issue: IssueWithDetails;
  user: PinPointSupabaseUser | null;
  hasPermission: (permission: string) => boolean;
  onError: (error: string) => void;
}

export function IssueComments({
  issue,
  user: _user,
  hasPermission,
  onError,
}: IssueCommentsProps): React.JSX.Element {
  const [commentText, setCommentText] = useState("");
  // isInternal functionality removed until implemented in database
  const [isSubmitting, setIsSubmitting] = useState(false);

  const utils = api.useUtils();
  const createComment = api.issue.comment.addComment.useMutation({
    onSuccess: () => {
      setCommentText("");
      void utils.issue.core.getById.invalidate({ id: issue.id });
    },
    onError: (error) => {
      onError(error.message);
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const handleSubmitComment = (): void => {
    if (!commentText.trim()) return;

    setIsSubmitting(true);
    createComment.mutate({
      issueId: issue.id,
      content: commentText,
    });
  };

  // Remove unused variable
  // Internal comment permissions - for future implementation
  // const canViewInternal = hasPermission("issues:read_internal");
  // const canCreateInternal = hasPermission("issues:comment_internal");

  // For now, all comments are visible (isInternal functionality not implemented in DB)
  const visibleComments = issue.comments;

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
                    {comment.author.name?.[0] ?? "?"}
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
                      {/* Comment visibility badges removed until isInternal is implemented */}
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
      <PermissionGate permission="issue:create" hasPermission={hasPermission}>
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
            onChange={(e) => {
              setCommentText(e.target.value);
            }}
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
              {/* Internal comment toggle removed until implemented in database */}
            </Box>

            <PermissionButton
              permission="issue:create"
              hasPermission={hasPermission}
              variant="contained"
              onClick={handleSubmitComment}
              disabled={!commentText.trim() || isSubmitting}
              data-testid="submit-comment-button"
            >
              {isSubmitting ? "Posting..." : "Post Comment"}
            </PermissionButton>
          </Stack>
        </Box>
      </PermissionGate>

      {/* Add Comment Button (for mobile/compact view) */}
      <PermissionGate
        permission="issue:create"
        hasPermission={hasPermission}
        fallback={
          <Box data-testid="no-comment-permission">
            <Alert severity="info">
              You need permission to create issues to add comments
            </Alert>
          </Box>
        }
        showFallback={false}
      >
        <Box sx={{ display: { xs: "block", md: "none" }, mt: 2 }}>
          <PermissionButton
            permission="issue:create"
            hasPermission={hasPermission}
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
          </PermissionButton>
        </Box>
      </PermissionGate>
    </Box>
  );
}
