import { useCurrentUser } from "~/lib/hooks/use-current-user";
import { api } from "~/trpc/react";

export function useCommentPermissions() {
  const { user } = useCurrentUser();
  const { data: members } = api.user.getAllInOrganization.useQuery();

  const currentUserMembership = members?.find(
    (member) => member.id === user?.id,
  );
  const userRole = currentUserMembership?.role;

  const canEdit = (comment: { authorId: string }) => {
    if (!user) return false;
    // Users can only edit their own comments (not even admins can edit others' comments)
    return comment.authorId === user.id;
  };

  const canDelete = (comment: { authorId: string }) => {
    if (!user) return false;
    // Users can delete their own comments, admins can delete any comment
    return comment.authorId === user.id || userRole === "admin";
  };

  return {
    canEdit,
    canDelete,
    userRole,
    currentUserId: user?.id,
    isAuthenticated: !!user,
  };
}
