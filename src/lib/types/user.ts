export type UserRole = "guest" | "member" | "admin";
export type UserStatus = "active" | "unconfirmed";

export interface UnifiedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl: string | null;
  inviteSentAt?: Date | null; // Only for unconfirmed users
}

export interface MachineOwner {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
}
