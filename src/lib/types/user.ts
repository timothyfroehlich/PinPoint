/**
 * User context for RLS enforcement
 */

export const USER_ROLES = ["admin", "technician", "member", "guest"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface UserContext {
  id: string;
  role: UserRole;
}

export type UserStatus = "active" | "invited";

export interface UnifiedUser {
  id: string;
  name: string;
  lastName: string;
  email?: string | null;
  role: UserRole;
  status: UserStatus;
  avatarUrl: string | null;
  inviteSentAt?: Date | null; // Only for invited users
  machineCount: number; // Number of machines owned by this user
}

export interface MachineOwner {
  id: string;
  name: string;
  email?: string | null;
  status: UserStatus;
}
