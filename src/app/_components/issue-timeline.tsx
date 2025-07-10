"use client";

import {
  History,
  VisibilityOff,
  Visibility,
  MoreVert,
  Edit,
  Delete,
} from "@mui/icons-material";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import React, { useState } from "react";

import { UserAvatar } from "./user-avatar";

import { useCommentPermissions } from "~/lib/hooks/use-comment-permissions";
import { api } from "~/trpc/react";

// Type definitions that match the API response
type TimelineItem =
  | {
      id: string;
      content: string;
      author: {
        id: string;
        name: string | null;
        profilePicture: string | null;
      };
      createdAt: Date;
      editedAt: Date | null;
      edited: boolean;
      itemType: "comment";
      timestamp: Date;
    }
  | {
      id: string;
      type: "created" | "status_change" | "assignment" | "field_update";
      actor: {
        id: string;
        name: string | null;
        profilePicture: string | null;
      } | null;
      description: string | null;
      createdAt: Date;
      itemType: "activity";
      timestamp: Date;
    };

interface IssueTimelineProps {
  timeline: TimelineItem[];
  showActivity: boolean;
  onToggleActivity: () => void;
  canToggleActivity: boolean;
  issueId: string;
}

export function IssueTimeline({
  timeline,
  showActivity,
  onToggleActivity,
  canToggleActivity,
  issueId,
}: IssueTimelineProps) {
  const { canEdit, canDelete } = useCommentPermissions();
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [commentMenuAnchor, setCommentMenuAnchor] =
    useState<HTMLElement | null>(null);
  const [menuCommentId, setMenuCommentId] = useState<string | null>(null);

  const utils = api.useUtils();
  const editCommentMutation = api.issue.editComment.useMutation({
    onSuccess: () => {
      setEditingCommentId(null);
      setEditContent("");
      void utils.issue.getTimeline.invalidate({ issueId });
    },
  });

  const deleteCommentMutation = api.issue.deleteComment.useMutation({
    onSuccess: () => {
      setDeleteDialogOpen(false);
      setCommentToDelete(null);
      void utils.issue.getTimeline.invalidate({ issueId });
    },
  });

  const handleEditClick = (comment: TimelineItem & { itemType: "comment" }) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
    setCommentMenuAnchor(null);
    setMenuCommentId(null);
  };

  const handleDeleteClick = (commentId: string) => {
    setCommentToDelete(commentId);
    setDeleteDialogOpen(true);
    setCommentMenuAnchor(null);
    setMenuCommentId(null);
  };

  const handleSaveEdit = () => {
    if (editingCommentId && editContent.trim()) {
      editCommentMutation.mutate({
        commentId: editingCommentId,
        content: editContent.trim(),
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditContent("");
  };

  const handleConfirmDelete = () => {
    if (commentToDelete) {
      deleteCommentMutation.mutate({
        commentId: commentToDelete,
      });
    }
  };

  const handleMenuClick = (
    event: React.MouseEvent<HTMLElement>,
    commentId: string,
  ) => {
    setCommentMenuAnchor(event.currentTarget);
    setMenuCommentId(commentId);
  };

  const handleMenuClose = () => {
    setCommentMenuAnchor(null);
    setMenuCommentId(null);
  };

  const formatEditedTime = (editedAt: Date) => {
    const now = new Date();
    const diff = now.getTime() - editedAt.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) {
      return `edited ${days} day${days > 1 ? "s" : ""} ago`;
    } else if (hours > 0) {
      return `edited ${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else if (minutes > 0) {
      return `edited ${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    } else {
      return "edited just now";
    }
  };

  const filteredTimeline = showActivity
    ? timeline
    : timeline.filter((item) => item.itemType === "comment");

  const formatActivityDescription = (
    activity: TimelineItem & { itemType: "activity" },
  ) => {
    // Handle different activity types with more user-friendly descriptions
    switch (activity.type) {
      case "created":
        return "created this issue";
      case "status_change":
        return activity.description;
      case "assignment":
        return activity.description;
      case "field_update":
        return activity.description;
      default:
        return activity.description ?? "performed an action";
    }
  };

  return (
    <Box>
      {/* Activity Toggle */}
      {canToggleActivity && (
        <Box sx={{ mb: 3, display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={showActivity ? <VisibilityOff /> : <Visibility />}
            onClick={onToggleActivity}
            sx={{
              borderColor: "divider",
              color: "text.secondary",
              "&:hover": {
                borderColor: "primary.main",
                backgroundColor: "action.hover",
              },
            }}
          >
            {showActivity ? "Hide" : "Show"} Issue Activity
          </Button>
        </Box>
      )}

      {/* Timeline */}
      <Box>
        {filteredTimeline.map((item, index) => (
          <Box key={item.id} sx={{ position: "relative" }}>
            {/* Timeline Line */}
            {index < filteredTimeline.length - 1 && (
              <Box
                sx={{
                  position: "absolute",
                  left: 20,
                  top: 60,
                  width: 2,
                  height: "calc(100% - 60px)",
                  backgroundColor: "divider",
                  zIndex: 1,
                }}
              />
            )}

            {item.itemType === "comment" ? (
              /* Comment */
              <Card
                sx={{
                  mb: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  position: "relative",
                  zIndex: 2,
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      mb: 2,
                      justifyContent: "space-between",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <UserAvatar user={item.author} size="medium" />
                      <Box>
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 600 }}
                        >
                          {item.author.name ?? "Unknown"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(item.createdAt).toLocaleString()}
                          {item.edited && item.editedAt && (
                            <>
                              {" • "}
                              <span style={{ fontStyle: "italic" }}>
                                {formatEditedTime(new Date(item.editedAt))}
                              </span>
                            </>
                          )}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Comment Actions Menu */}
                    {(canEdit({ authorId: item.author.id }) ||
                      canDelete({ authorId: item.author.id })) && (
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuClick(e, item.id)}
                        sx={{ opacity: 0.6, "&:hover": { opacity: 1 } }}
                      >
                        <MoreVert fontSize="small" />
                      </IconButton>
                    )}
                  </Box>

                  {/* Comment Content - either editing or display */}
                  {editingCommentId === item.id ? (
                    <Box sx={{ mt: 2 }}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        variant="outlined"
                        size="small"
                      />
                      <Box
                        sx={{
                          mt: 1,
                          display: "flex",
                          gap: 1,
                          justifyContent: "flex-end",
                        }}
                      >
                        <Button size="small" onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={handleSaveEdit}
                          disabled={
                            !editContent.trim() || editCommentMutation.isPending
                          }
                        >
                          {editCommentMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <Typography
                      variant="body1"
                      sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}
                    >
                      {item.content}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* Activity */
              <Box
                sx={{
                  mb: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  position: "relative",
                  zIndex: 2,
                }}
              >
                {/* Activity Dot */}
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    backgroundColor: "grey.100",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid",
                    borderColor: "background.paper",
                  }}
                >
                  <History sx={{ fontSize: 16, color: "text.secondary" }} />
                </Box>

                {/* Activity Content */}
                <Box sx={{ flexGrow: 1 }}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ lineHeight: 1.4 }}
                  >
                    {item.actor ? (
                      <>
                        <strong>{item.actor.name ?? "Unknown"}</strong>{" "}
                        {formatActivityDescription(
                          item as TimelineItem & { itemType: "activity" },
                        )}
                      </>
                    ) : (
                      <>
                        System{" "}
                        {formatActivityDescription(
                          item as TimelineItem & { itemType: "activity" },
                        )}
                      </>
                    )}
                    {" • "}
                    <span style={{ fontSize: "0.85em" }}>
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        ))}

        {filteredTimeline.length === 0 && (
          <Box
            sx={{
              textAlign: "center",
              py: 4,
              color: "text.secondary",
            }}
          >
            <Typography variant="body2">
              {showActivity
                ? "No comments or activities yet."
                : "No comments yet."}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Comment Actions Menu */}
      <Menu
        anchorEl={commentMenuAnchor}
        open={Boolean(commentMenuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        {(() => {
          if (!menuCommentId) return null;
          const comment = filteredTimeline.find(
            (item) => item.id === menuCommentId,
          );
          if (!comment || comment.itemType !== "comment") return null;

          return (
            <>
              {canEdit({ authorId: comment.author.id }) && (
                <MenuItem onClick={() => handleEditClick(comment)}>
                  <ListItemIcon>
                    <Edit fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Edit comment</ListItemText>
                </MenuItem>
              )}
              {canDelete({ authorId: comment.author.id }) && (
                <MenuItem onClick={() => handleDeleteClick(menuCommentId)}>
                  <ListItemIcon>
                    <Delete fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Delete comment</ListItemText>
                </MenuItem>
              )}
            </>
          );
        })()}
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Comment</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this comment? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={deleteCommentMutation.isPending}
          >
            {deleteCommentMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
