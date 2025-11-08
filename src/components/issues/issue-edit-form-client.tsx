"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";
import { toast } from "sonner";

interface IssueEditFormClientProps {
  issueId: string;
  currentTitle: string;
  currentDescription: string | null;
  onSuccess?: () => void;
}

export function IssueEditFormClient({
  issueId,
  currentTitle,
  currentDescription,
  onSuccess,
}: IssueEditFormClientProps): JSX.Element {
  const router = useRouter();
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription ?? "");

  const updateMutation = api.issue.core.update.useMutation({
    onSuccess: () => {
      toast.success("Issue updated successfully");
      router.refresh(); // Refresh server components
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update issue");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate title
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (title.length > 255) {
      toast.error("Title must be less than 255 characters");
      return;
    }

    // Call mutation
    updateMutation.mutate({
      id: issueId,
      title: title.trim(),
      description: description.trim() || null,
    });
  };

  const isChanged =
    title.trim() !== currentTitle ||
    (description.trim() || null) !== currentDescription;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">
          Title <span className="text-error">*</span>
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter issue title"
          required
          maxLength={255}
          disabled={updateMutation.isPending}
        />
        <p className="text-xs text-muted-foreground">
          {title.length}/255 characters
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue in detail"
          rows={6}
          disabled={updateMutation.isPending}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onSuccess?.()}
          disabled={updateMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!isChanged || updateMutation.isPending}
        >
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {updateMutation.isError && (
        <p className="text-error text-sm">
          {updateMutation.error.message || "An error occurred"}
        </p>
      )}
    </form>
  );
}
