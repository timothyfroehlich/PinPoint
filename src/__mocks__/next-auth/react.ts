import { type ReactNode } from "react";

export const useSession = jest.fn();

export const signIn = jest.fn();

export const signOut = jest.fn();

export const SessionProvider = jest
  .fn()
  .mockImplementation(({ children }: { children: ReactNode }) => children);

export const getSession = jest.fn();
