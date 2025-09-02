/**
 * Realtime Comments Client Island
 * Phase 3D: Focused client island for real-time comment updates
 * Example implementation from Phase 3D specification
 */

"use client";

import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { MessageSquareIcon } from "lucide-react";
import { REALTIME_SUBSCRIBE_STATES } from "@supabase/realtime-js";

interface Comment {
  id: string;
  content: string;
  author_id: string;
  issue_id: string;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    name: string | null;
    email: string;
    avatar_url?: string;
  };
}

interface RealtimeCommentsClientProps {
  issueId: string;
  currentUserId?: string;
  existingCommentIds?: string[];
}

/**
 * Focused client island for real-time comment updates
 * Shows new comments from other users in real-time
 * Own comments are handled optimistically by the comment form
 */
export function RealtimeCommentsClient({
  issueId,
  currentUserId,
  existingCommentIds = [],
}: RealtimeCommentsClientProps) {
  const [newComments, setNewComments] = useState<Comment[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState<{
    status: string;
    user: string;
    timestamp: string;
  } | null>(null);

  useEffect(() => {
    if (!currentUserId) return;

    // Import Supabase client dynamically to avoid SSR issues
    const initializeRealtimeConnection = async () => {
      try {
        const { createClient } = await import("~/utils/supabase/client");
        const supabase = createClient();

        setIsConnected(true);

        const channel = supabase
          .channel(`issue-${issueId}-realtime`)
          // Listen for new comments
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "comments",
              filter: `issue_id=eq.${issueId}`,
            },
            (payload) => {
              // Only show comments from other users and not already loaded
              if (
                payload.new["author_id"] !== currentUserId &&
                !existingCommentIds.includes(String(payload.new["id"]))
              ) {
                const newComment = payload.new as Comment;

                setNewComments((prev) => {
                  // Avoid duplicates
                  if (prev.some((c) => c.id === newComment.id)) {
                    return prev;
                  }
                  return [...prev, newComment];
                });

                // Auto-remove notification after 45 seconds
                setTimeout(() => {
                  setNewComments((prev) =>
                    prev.filter((c) => c.id !== newComment.id),
                  );
                }, 45000);
              }
            },
          )
          // Listen for comment updates (edits)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "comments",
              filter: `issue_id=eq.${issueId}`,
            },
            (payload) => {
              // Update existing comment in real-time
              if (payload.new["author_id"] !== currentUserId) {
                const updatedComment = payload.new as Comment;

                setNewComments((prev) => {
                  const existingIndex = prev.findIndex(
                    (c) => c.id === updatedComment.id,
                  );
                  if (existingIndex !== -1) {
                    const updated = [...prev];
                    updated[existingIndex] = updatedComment;
                    return updated;
                  }
                  return prev;
                });
              }
            },
          )
          // Listen for issue status changes
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "issues",
              filter: `id=eq.${issueId}`,
            },
            (payload) => {
              // Show status update notification
              if (payload.new["updated_at"] !== payload.old["updated_at"]) {
                setStatusUpdate({
                  status: "Status updated",
                  user: "Someone",
                  timestamp: new Date().toISOString(),
                });

                // Auto-remove status notification after 10 seconds
                setTimeout(() => {
                  setStatusUpdate(null);
                }, 10000);
              }
            },
          )
          .subscribe((status) => {
            if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
              setIsConnected(true);
            } else if (status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR) {
              setIsConnected(false);
            }
          });

        return () => {
          void supabase.removeChannel(channel);
          setIsConnected(false);
        };
      } catch (error) {
        console.error("Failed to initialize realtime connection:", error);
        setIsConnected(false);
        return () => {
          // No-op cleanup function on error
        };
      }
    };

    let cleanupFunction: (() => void) | null = null;

    // Initialize async connection and store cleanup function
    void initializeRealtimeConnection()
      .then((cleanup) => {
        cleanupFunction = cleanup;
      })
      .catch(console.error);

    return () => {
      if (cleanupFunction) {
        cleanupFunction();
      }
    };
  }, [issueId, currentUserId, existingCommentIds]);

  // Don't render anything if no new comments and no status updates
  if (newComments.length === 0 && !statusUpdate) {
    return null;
  }

  return (
    <div className="space-y-3 mt-4">
      {/* Connection status indicator */}
      {(newComments.length > 0 || statusUpdate) && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <MessageSquareIcon className="h-4 w-4" />
            {newComments.length > 0 && statusUpdate
              ? "Live updates:"
              : newComments.length > 0
                ? "New comments from other users:"
                : "Issue updated:"}
          </div>
          <Badge
            variant={isConnected ? "secondary" : "outline"}
            className="text-xs"
          >
            {isConnected ? "Live" : "Disconnected"}
          </Badge>
        </div>
      )}

      {/* Status update notification */}
      {statusUpdate && (
        <Alert className="border-primary bg-primary-container">
          <AlertDescription>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Issue Updated
              </Badge>
              <span className="text-sm font-medium">{statusUpdate.status}</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(statusUpdate.timestamp), {
                  addSuffix: true,
                })}
              </span>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Real-time comment notifications */}
      {newComments.map((comment) => (
        <Alert
          key={comment.id}
          className="border-tertiary bg-tertiary-container"
        >
          <AlertDescription>
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {comment.author?.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("") ?? "U"}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {comment.author?.name ?? "Someone"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    New Comment
                  </Badge>
                </div>

                <div className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">
                  {comment.content}
                </div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      ))}

      {/* Instructions for viewing all comments */}
      {newComments.length > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          New comments will automatically integrate into the main thread
        </p>
      )}
    </div>
  );
}
