import path from "path";

const authDir = path.join(import.meta.dirname, "../.auth");

export const STORAGE_STATE: Record<string, string> = {
  admin: path.join(authDir, "admin.json"),
  member: path.join(authDir, "member.json"),
  guest: path.join(authDir, "guest.json"),
  technician: path.join(authDir, "technician.json"),
  usernameAccount: path.join(authDir, "usernameAccount.json"),
};

// Empty state for tests that test auth flows themselves
export const NO_AUTH_STATE = { cookies: [] as never[], origins: [] as never[] };
