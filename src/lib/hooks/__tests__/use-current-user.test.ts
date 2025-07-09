import { renderHook } from "@testing-library/react";
import { useCurrentUser } from "../use-current-user";
import { mockUseSession } from "./auth-test-helpers";

describe("useCurrentUser", () => {
  it("should return loading state initially", () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "loading",
    });

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBe(null);
  });

  it("should return unauthenticated state", () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBe(null);
  });

  it("should return authenticated state with session user", () => {
    const session = {
      user: {
        id: "1",
        name: "Test User",
        email: "test@example.com",
        image: "/test.jpg",
      },
    };

    mockUseSession.mockReturnValue({
      data: session,
      status: "authenticated",
    });

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(session.user);
  });
});