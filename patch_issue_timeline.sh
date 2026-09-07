sed -i '4i import { checkPermission } from "~\/lib\/permissions\/helpers";' src/components/issues/IssueTimeline.tsx
sed -i 's/    (currentUserId === event.author.id || currentUserRole === "admin") &&/    (currentUserId === event.author.id || checkPermission("comments.delete.any", currentUserRole)) \&\&/g' src/components/issues/IssueTimeline.tsx
