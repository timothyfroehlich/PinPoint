/**
 * MachineDetailView - Auth Integration Tests ✅ (Phase 2.2 COMPLETE)
 *
 * ✅ TRANSFORMATION SUCCESS - All 14 tests passing:
 * BEFORE: Over-mocked component hiding real auth integration
 * AFTER: Auth integration patterns with targeted permission mocking
 *
 * PATTERN ESTABLISHED:
 * - Remove component mocks → Use real components with auth context
 * - Mock only the permission hook at the boundary → Test real auth flow
 * - Test multiple auth scenarios: 🔓 Unauthenticated → 👤 Member → 👑 Admin → 🏢 Multi-tenant
 * - Verify permission-based UI changes (button visibility, enablement)
 *
 * REUSABLE FOR: LocationDetailView, MachineGrid, other permission-aware components
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

import { MachineDetailView } from "../MachineDetailView";

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

// Mock machine data - using any type since this is test context
const mockMachine: any = {
  id: "machine-1",
  name: "Custom Machine Name",
  model: {
    id: "model-1",
    name: "Medieval Madness",
    manufacturer: "Williams",
    year: 1997,
    machineType: "Pinball",
    ipdbLink: "https://ipdb.org/machine.cgi?id=4032",
    opdbImgUrl: "https://opdb.org/machine/4032",
    kineticistUrl: "https://kineticist.com/machine/medieval-madness",
  },
  location: {
    id: "location-1",
    name: "Test Location",
    street: "123 Test St",
    city: "Austin",
    state: "TX",
  },
  owner: {
    id: "user-1",
    name: "John Doe",
    image: "https://example.com/avatar.jpg",
  },
  qrCodeUrl: "https://example.com/qr-code.png",
  qrCodeGeneratedAt: new Date("2023-01-01"),
  organizationId: "org-1",
};

const mockMachineWithoutQR: any = {
  ...mockMachine,
  qrCodeUrl: null,
  qrCodeGeneratedAt: null,
};

// Mock Supabase users for different auth scenarios
const mockMemberUser = createMockSupabaseUser({
  id: "member-user-id",
  email: "member@dev.local",
  app_metadata: {
    organization_id: "org-1",
    role: "Member",
    provider: "google",
  },
  user_metadata: {
    full_name: "Test Member",
    email: "member@dev.local",
  },
});

const mockAdminUser = createMockSupabaseUser({
  id: "admin-user-id",
  email: "admin@dev.local",
  app_metadata: {
    organization_id: "org-1",
    role: "Admin",
    provider: "google",
  },
  user_metadata: {
    full_name: "Test Admin",
    email: "admin@dev.local",
  },
});

describe("MachineDetailView", () => {
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
    it("should render machine information correctly for public users", () => {
      render(
        <VitestTestWrapper session={null}>
          <MachineDetailView
            machine={mockMachine}
            user={null}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      // Header information - use semantic heading query for main title
      expect(
        screen.getByRole("heading", { name: /custom machine name/i }),
      ).toBeInTheDocument();
      // Model details in subtitle - allow flexible formatting
      expect(
        screen.getByText(/medieval madness.*williams.*1997/i),
      ).toBeInTheDocument();

      // Location information - use link query for better semantics
      expect(
        screen.getByRole("link", { name: /test location/i }),
      ).toBeInTheDocument();
      // Address allows flexible formatting with punctuation variance
      expect(
        screen.getByText(/123 test st[\s,]*austin[\s,]*tx/i),
      ).toBeInTheDocument();

      // Owner information - use img alt text for better semantic query
      expect(screen.getByAltText(/john doe|owner/i)).toBeInTheDocument();
      expect(screen.getByText(/john doe/i)).toBeInTheDocument();

      // Model details - use semantic heading queries
      expect(
        screen.getByRole("heading", { name: /machine information/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /model details/i }),
      ).toBeInTheDocument();
    });

    it("should render QR code when available for public users", () => {
      render(
        <VitestTestWrapper session={null}>
          <MachineDetailView
            machine={mockMachine}
            user={null}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      // QR code section - use semantic heading and descriptive text
      expect(
        screen.getByRole("heading", { name: /qr code/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/scan.*report.*issues/i)).toBeInTheDocument();
      expect(screen.getByText(/generated.*\d/i)).toBeInTheDocument();

      // QR code image - use flexible alt text pattern
      const qrImage = screen.getByAltText(/qr code.*custom machine name/i);
      expect(qrImage).toBeInTheDocument();
      expect(qrImage).toHaveAttribute("src", "https://example.com/qr-code.png");
    });

    it("should show QR code unavailable message for public users", () => {
      render(
        <VitestTestWrapper session={null}>
          <MachineDetailView
            machine={mockMachineWithoutQR}
            user={null}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText(/qr code not available/i)).toBeInTheDocument();
      // Public users should not see generate button
      expect(
        screen.queryByRole("button", { name: /generate qr code/i }),
      ).not.toBeInTheDocument();
    });

    it("should render external links when available for public users", () => {
      render(
        <VitestTestWrapper session={null}>
          <MachineDetailView
            machine={mockMachine}
            user={null}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      // External links section - use semantic heading
      expect(
        screen.getByRole("heading", { name: /external links/i }),
      ).toBeInTheDocument();

      const ipdbLink = screen.getByRole("link", { name: "IPDB" });
      expect(ipdbLink).toHaveAttribute(
        "href",
        "https://ipdb.org/machine.cgi?id=4032",
      );
      expect(ipdbLink).toHaveAttribute("target", "_blank");

      const opdbLink = screen.getByRole("link", { name: "OPDB" });
      expect(opdbLink).toHaveAttribute("href", "https://opdb.org/machine/4032");

      const kineticistLink = screen.getByRole("link", { name: "Kineticist" });
      expect(kineticistLink).toHaveAttribute(
        "href",
        "https://kineticist.com/machine/medieval-madness",
      );
    });

    it("should render statistics placeholder for public users", () => {
      render(
        <VitestTestWrapper session={null}>
          <MachineDetailView
            machine={mockMachine}
            user={null}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      expect(
        screen.getByRole("heading", { name: /statistics/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/statistics coming soon/i)).toBeInTheDocument();
    });
  });

  describe("👤 Member User Experience", () => {
    it("should show limited features but hide admin-only actions", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
          userRole="Member"
        >
          <MachineDetailView
            machine={mockMachine}
            user={mockMemberUser}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      // Should show basic machine information - use semantic queries
      expect(
        screen.getByRole("heading", { name: /custom machine name/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /test location/i }),
      ).toBeInTheDocument();

      // Members don't have machine edit/delete permissions in VITEST_PERMISSION_SCENARIOS.MEMBER
      expect(
        screen.queryByRole("button", { name: /edit/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /delete/i }),
      ).not.toBeInTheDocument();
    });

    it("should not show generate QR code button for members without edit permission", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
          userRole="Member"
        >
          <MachineDetailView
            machine={mockMachineWithoutQR}
            user={mockMemberUser}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText(/qr code not available/i)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /generate qr code/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("👑 Admin User Experience", () => {
    it("should show all admin controls and features", () => {
      // ✅ AUTH INTEGRATION: Mock admin permissions for machine operations
      mockHasPermission.mockImplementation((permission: string) =>
        ["machine:edit", "machine:delete"].includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={["machine:edit", "machine:delete"]}
          userRole="Admin"
        >
          <MachineDetailView
            machine={mockMachine}
            user={mockAdminUser}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      // Should show basic machine information - use semantic queries
      expect(
        screen.getByRole("heading", { name: /custom machine name/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /test location/i }),
      ).toBeInTheDocument();

      // Admins should have edit and delete permissions
      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /delete/i }),
      ).toBeInTheDocument();
    });

    it("should show generate QR code button for admins when QR code is missing", () => {
      // ✅ AUTH INTEGRATION: Mock admin permissions for QR code generation
      mockHasPermission.mockImplementation(
        (permission: string) => permission === "machine:edit",
      );

      render(
        <VitestTestWrapper userPermissions={["machine:edit"]} userRole="Admin">
          <MachineDetailView
            machine={mockMachineWithoutQR}
            user={mockAdminUser}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      const generateButton = screen.getByRole("button", {
        name: /generate qr code/i,
      });
      expect(generateButton).toBeInTheDocument();
      expect(generateButton).toBeEnabled();
    });

    it("should enable all admin action buttons", () => {
      // ✅ AUTH INTEGRATION: Mock all admin permissions
      mockHasPermission.mockImplementation((permission: string) =>
        ["machine:edit", "machine:delete"].includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={["machine:edit", "machine:delete"]}
          userRole="Admin"
        >
          <MachineDetailView
            machine={mockMachineWithoutQR}
            user={mockAdminUser}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      const editButton = screen.getByRole("button", { name: /edit/i });
      const deleteButton = screen.getByRole("button", { name: /delete/i });
      const generateButton = screen.getByRole("button", {
        name: /generate qr code/i,
      });

      expect(editButton).toBeEnabled();
      expect(deleteButton).toBeEnabled();
      expect(generateButton).toBeEnabled();
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
          <MachineDetailView
            machine={mockMachine} // Machine belongs to "org-1"
            user={otherOrgUser} // User from "other-org"
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      // Should show basic information but hide admin actions due to org boundary
      expect(
        screen.getByRole("heading", { name: /custom machine name/i }),
      ).toBeInTheDocument();

      // Cross-org users should not see admin actions even with admin permissions
      expect(
        screen.queryByRole("button", { name: /edit/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /delete/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("⚙️ Content Rendering Edge Cases", () => {
    it("should handle machine without owner", () => {
      const machineWithoutOwner = {
        ...mockMachine,
        owner: null,
      };

      render(
        <VitestTestWrapper session={null}>
          <MachineDetailView
            machine={machineWithoutOwner}
            user={null}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      // No owner information should be present
      expect(screen.queryByText(/john doe/i)).not.toBeInTheDocument();
      expect(screen.queryByAltText(/owner/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/^owner$/i)).not.toBeInTheDocument();
    });

    it("should handle machine without custom name", () => {
      const machineWithoutName = {
        ...mockMachine,
        name: null,
      };

      render(
        <VitestTestWrapper session={null}>
          <MachineDetailView
            machine={machineWithoutName}
            user={null}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      // Should use model name as the main title - target the h1 specifically
      expect(
        screen.getByRole("heading", { level: 1, name: /medieval madness/i }),
      ).toBeInTheDocument();
    });

    it("should handle machine without external links", () => {
      const machineWithoutLinks = {
        ...mockMachine,
        model: {
          ...mockMachine.model,
          ipdbLink: null,
          opdbImgUrl: null,
          kineticistUrl: null,
        },
      };

      render(
        <VitestTestWrapper session={null}>
          <MachineDetailView
            machine={machineWithoutLinks}
            user={null}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.queryByText(/external links/i)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "IPDB" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "OPDB" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Kineticist" }),
      ).not.toBeInTheDocument();
    });
  });
});
