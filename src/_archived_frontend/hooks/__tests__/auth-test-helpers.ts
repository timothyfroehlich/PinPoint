import { useSession } from "next-auth/react";

// Mock the useSession hook
jest.mock("next-auth/react");

export const mockUseSession = useSession as jest.MockedFunction<
  typeof useSession
>;
