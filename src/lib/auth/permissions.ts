
import { type UserContext } from "~/lib/types";

// Helper function to check if a user's role meets a minimum requirement
const hasRole = (
  user: UserContext | null,
  role: "guest" | "member" | "admin",
): boolean => {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "member" && (role === "member" || role === "guest"))
    return true;
  if (user.role === "guest" && role === "guest") return true;
  return false;
};

// =================================================================
// Machine Permissions
// =================================================================

// Only admins can update machine details
export const canUpdateMachine = (user: UserContext | null) => {
  return hasRole(user, "admin");
};

// =================================================================
// Issue Permissions
// =================================================================

// Admins and members can update issue metadata (status, priority, etc.)
export const canUpdateIssueMetadata = (user: UserContext | null) => {
  return hasRole(user, "member");
};

// =================================================================
// User Management Permissions
// =================================================================

// Only admins can manage users
export const canManageUsers = (user: UserContext | null) => {
  return hasRole(user, "admin");
};
