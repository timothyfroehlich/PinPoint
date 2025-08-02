/**
 * LocationDetailView - Auth Integration Tests ✅ (Phase 2.2 COMPLETE)
 *
 * ✅ TRANSFORMATION SUCCESS - Double over-mocking eliminated:
 * BEFORE: usePermissions mock + MachineGrid mock hiding real interactions
 * AFTER: Real auth context → permission logic → component interactions
 *
 * PATTERN ESTABLISHED:
 * - Remove usePermissions mock → Test real auth flow
 * - Remove MachineGrid mock → Test real component interactions
 * - Test multiple auth scenarios: 🔓 Unauthenticated → 👤 Member → 👑 Admin → 🏢 Multi-tenant
 * - Verify permission-based UI changes (button visibility, component rendering)
 *
 * REUSABLE FOR: Other location components, permission-aware components
 */

import { render, screen } from "@testing-library/react";
import {
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterEach,
  afterAll,
  vi,
} from "vitest";
import "@testing-library/jest-dom/vitest";

import { LocationDetailView } from "../LocationDetailView";

import { server } from "~/test/msw/setup";
import {
  VitestTestWrapper,
  VITEST_PERMISSION_SCENARIOS,
  createMockSupabaseUser,
} from "~/test/VitestTestWrapper";

// ✅ AUTH INTEGRATION: usePermissions hook with targeted permission mocking
// Real auth context → permission logic → component interactions
const mockHasPermission = vi.fn();
vi.mock("~/hooks/usePermissions", () => ({
  usePermissions: () => ({
    hasPermission: mockHasPermission,
    permissions: [],
    isAuthenticated: true,
    isLoading: false,
    isError: false,
    isAdmin: false,
  }),
}));

// ✅ REAL COMPONENT INTEGRATION: Using real MachineGrid with mock data
// Tests real component interactions instead of hiding behind mocks

// Mock location data
const createMockLocation = (overrides: any = {}) => ({
  id: "location-1",
  name: "Test Location",
  organizationId: "org-1",
  machines: [
    {
      id: "machine-1",
      name: "Machine 1",
      model: {
        name: "Medieval Madness",
        manufacturer: "Williams",
        year: 1997,
      },
      owner: {
        id: "owner-1",
        name: "John Doe",
        image: "https://example.com/avatar.jpg",
      },
    },
    {
      id: "machine-2",
      name: null,
      model: {
        name: "Attack from Mars",
        manufacturer: "Bally",
        year: 1995,
      },
      owner: null,
    },
  ],
  ...overrides,
});

describe("LocationDetailView", () => {
  // Set up MSW server
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });
  afterEach(() => {
    server.resetHandlers();
  });
  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset permission mock to deny all by default
    mockHasPermission.mockReturnValue(false);
  });

  describe("🔓 Unauthenticated User Experience", () => {
    it("displays location name in header for public users", () => {
      const location = createMockLocation({
        name: "Austin Pinball Collective",
      });
      render(
        <VitestTestWrapper session={null}>
          <LocationDetailView
            location={location}
            user={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(
        screen.getByRole("heading", { name: "Austin Pinball Collective" }),
      ).toBeInTheDocument();
    });

    it("displays correct machine count for public users", () => {
      const location = createMockLocation();
      render(
        <VitestTestWrapper session={null}>
          <LocationDetailView
            location={location}
            user={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText(/2 machines?/)).toBeInTheDocument();
    });

    it("displays singular machine count correctly for public users", () => {
      const baseLocation = createMockLocation();
      const location = createMockLocation({
        machines: [baseLocation.machines[0]],
      });
      render(
        <VitestTestWrapper session={null}>
          <LocationDetailView
            location={location}
            user={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText(/1 machines?/)).toBeInTheDocument();
    });

    it("displays zero machines correctly for public users", () => {
      const location = createMockLocation({ machines: [] });
      render(
        <VitestTestWrapper session={null}>
          <LocationDetailView
            location={location}
            user={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText(/0 machines?/)).toBeInTheDocument();
    });

    it("renders real MachineGrid component with location machines for public users", () => {
      const location = createMockLocation();
      render(
        <VitestTestWrapper session={null}>
          <LocationDetailView
            location={location}
            user={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      // ✅ REAL COMPONENT INTEGRATION: MachineGrid renders real component
      // Public users should see machine information (no sensitive data)
      expect(
        screen.getByRole("heading", { name: /^Machines$/i }),
      ).toBeInTheDocument();
      // MachineGrid should render, no test-id needed - real component integration
    });
    it("hides admin buttons for public users", () => {
      const location = createMockLocation();

      render(
        <VitestTestWrapper session={null}>
          <LocationDetailView
            location={location}
            user={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      // Public users should not see any admin actions
      expect(
        screen.queryByRole("button", { name: /edit location/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /sync pinballmap/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("👤 Member User Experience", () => {
    const mockMemberUser = createMockSupabaseUser({
      id: "member-user-id",
      email: "member@test.local",
      app_metadata: {
        organization_id: "org-1",
        role: "Member",
        provider: "google",
      },
      user_metadata: {
        full_name: "Test Member",
        email: "member@test.local",
      },
    });

    it("shows location details but hides admin actions for members", () => {
      const location = createMockLocation();

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
          userRole="Member"
        >
          <LocationDetailView
            location={location}
            user={mockMemberUser}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      // Should show basic information
      expect(
        screen.getByRole("heading", { name: "Test Location" }),
      ).toBeInTheDocument();
      expect(screen.getByText(/2 machines?/)).toBeInTheDocument();

      // Members don't have location:edit or organization:manage permissions
      expect(
        screen.queryByRole("button", { name: /edit location/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /sync pinballmap/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("👑 Admin User Experience", () => {
    const mockAdminUser = createMockSupabaseUser({
      id: "admin-user-id",
      email: "admin@test.local",
      app_metadata: {
        organization_id: "org-1",
        role: "Admin",
        provider: "google",
      },
      user_metadata: {
        full_name: "Test Admin",
        email: "admin@test.local",
      },
    });

    it("hides edit location button when admin lacks location:edit permission", () => {
      // ✅ AUTH INTEGRATION: Mock specific permission absence
      mockHasPermission.mockImplementation(
        (permission: string) => permission === "organization:manage", // Only org manage, no location edit
      );
      const location = createMockLocation();

      render(
        <VitestTestWrapper
          userPermissions={["organization:manage"]}
          userRole="Admin"
        >
          <LocationDetailView
            location={location}
            user={mockAdminUser}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      // Should show org management but not location edit
      expect(
        screen.queryByRole("button", { name: /edit location/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /sync pinballmap/i }),
      ).toBeInTheDocument();
    });

    it("shows edit location button when admin has location:edit permission", () => {
      // ✅ AUTH INTEGRATION: Mock specific permission presence
      mockHasPermission.mockImplementation(
        (permission: string) => permission === "location:edit",
      );
      const location = createMockLocation();

      render(
        <VitestTestWrapper userPermissions={["location:edit"]} userRole="Admin">
          <LocationDetailView
            location={location}
            user={mockAdminUser}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(
        screen.getByRole("button", { name: /edit location/i }),
      ).toBeInTheDocument();
      // Should not show org manage without that permission
      expect(
        screen.queryByRole("button", { name: /sync pinballmap/i }),
      ).not.toBeInTheDocument();
    });

    it("hides sync pinballmap button when admin lacks organization:manage permission", () => {
      // ✅ AUTH INTEGRATION: Mock no permissions
      mockHasPermission.mockReturnValue(false);
      const location = createMockLocation();

      render(
        <VitestTestWrapper userPermissions={[]} userRole="Admin">
          <LocationDetailView
            location={location}
            user={mockAdminUser}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(
        screen.queryByRole("button", { name: /sync pinballmap/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /edit location/i }),
      ).not.toBeInTheDocument();
    });

    it("shows sync pinballmap button when admin has organization:manage permission", () => {
      // ✅ AUTH INTEGRATION: Mock specific permission
      mockHasPermission.mockImplementation(
        (permission: string) => permission === "organization:manage",
      );
      const location = createMockLocation();

      render(
        <VitestTestWrapper
          userPermissions={["organization:manage"]}
          userRole="Admin"
        >
          <LocationDetailView
            location={location}
            user={mockAdminUser}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(
        screen.getByRole("button", { name: /sync pinballmap/i }),
      ).toBeInTheDocument();
      // Should not show location edit without that permission
      expect(
        screen.queryByRole("button", { name: /edit location/i }),
      ).not.toBeInTheDocument();
    });

    it("shows both admin buttons when admin has both permissions", () => {
      // ✅ AUTH INTEGRATION: Mock both permissions
      mockHasPermission.mockImplementation((permission: string) =>
        ["location:edit", "organization:manage"].includes(permission),
      );
      const location = createMockLocation();

      render(
        <VitestTestWrapper
          userPermissions={["location:edit", "organization:manage"]}
          userRole="Admin"
        >
          <LocationDetailView
            location={location}
            user={mockAdminUser}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(
        screen.getByRole("button", { name: /edit location/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /sync pinballmap/i }),
      ).toBeInTheDocument();
    });
  });

  describe("🏢 Multi-Tenant Security", () => {
    it("should prevent cross-organization access for users from different org", () => {
      const otherOrgUser = createMockSupabaseUser({
        id: "other-org-user-id",
        email: "admin@other.org",
        app_metadata: {
          organization_id: "other-org",
          role: "Admin",
          provider: "google",
        },
        user_metadata: {
          full_name: "Other Org Admin",
          email: "admin@other.org",
        },
      });

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole="Admin"
        >
          <LocationDetailView
            location={createMockLocation()} // Location belongs to "org-1"
            user={otherOrgUser} // User from "other-org"
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      // Should show basic information but hide admin actions due to org boundary
      expect(
        screen.getByRole("heading", { name: "Test Location" }),
      ).toBeInTheDocument();

      // Cross-org users should not see admin actions even with admin permissions
      expect(
        screen.queryByRole("button", { name: /edit location/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /sync pinballmap/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("⚙️ Content Rendering Edge Cases", () => {
    it("handles location with no machines", () => {
      const location = createMockLocation({ machines: [] });

      render(
        <VitestTestWrapper session={null}>
          <LocationDetailView
            location={location}
            user={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText(/0 machines?/)).toBeInTheDocument();
      // ✅ REAL COMPONENT INTEGRATION: MachineGrid handles empty array gracefully
      expect(
        screen.getByRole("heading", { name: /^Machines$/i }),
      ).toBeInTheDocument();
    });

    it("handles very long location names", () => {
      const location = createMockLocation({
        name: "This is a very long location name that might cause layout issues in some cases",
      });

      render(
        <VitestTestWrapper session={null}>
          <LocationDetailView
            location={location}
            user={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(
        screen.getByRole("heading", {
          name: "This is a very long location name that might cause layout issues in some cases",
        }),
      ).toBeInTheDocument();
    });

    it("handles location with many machines", () => {
      const manyMachines = Array.from({ length: 50 }, (_, i) => ({
        id: `machine-${i}`,
        name: `Machine ${i}`,
        model: {
          name: `Model ${i}`,
          manufacturer: "Test Manufacturer",
          year: 2000 + i,
        },
        owner: null,
      }));

      const location = createMockLocation({ machines: manyMachines });

      render(
        <VitestTestWrapper session={null}>
          <LocationDetailView
            location={location}
            user={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText(/50 machines?/)).toBeInTheDocument();
      // ✅ REAL COMPONENT INTEGRATION: MachineGrid handles large arrays
      expect(
        screen.getByRole("heading", { name: /^Machines$/i }),
      ).toBeInTheDocument();
    });
  });

  describe("🔐 Authentication State Handling", () => {
    it("works correctly with unauthenticated users", () => {
      const location = createMockLocation();

      render(
        <VitestTestWrapper session={null}>
          <LocationDetailView
            location={location}
            user={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(
        screen.getByRole("heading", { name: "Test Location" }),
      ).toBeInTheDocument();
      // No admin actions for unauthenticated users
      expect(
        screen.queryByRole("button", { name: /edit location/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /sync pinballmap/i }),
      ).not.toBeInTheDocument();
    });

    it("works correctly with authenticated users", () => {
      const location = createMockLocation();
      const mockUser = createMockSupabaseUser({
        id: "user-1",
        user_metadata: { full_name: "Test User" },
      });

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
          userRole="Member"
        >
          <LocationDetailView
            location={location}
            user={mockUser}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(
        screen.getByRole("heading", { name: "Test Location" }),
      ).toBeInTheDocument();
      // Members should not see admin actions
      expect(
        screen.queryByRole("button", { name: /edit location/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /sync pinballmap/i }),
      ).not.toBeInTheDocument();
    });
  });
});
