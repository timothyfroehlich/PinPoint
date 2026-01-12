export type UserRole = "guest" | "member" | "admin";
export type UserStatus = "active" | "invited";

export interface UnifiedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl: string | null;
  inviteSentAt?: Date | null; // Only for invited users
}

export interface MachineOwner {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
}
