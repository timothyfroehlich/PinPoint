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
} from "~/test/VitestTestWrapper";

// Mock usePermissions hook
const mockHasPermission = vi.fn();
vi.mock("~/hooks/usePermissions", () => ({
  usePermissions: () => ({
    hasPermission: mockHasPermission,
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

const mockSession: any = {
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
  },
};

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
    mockHasPermission.mockReturnValue(false); // Default to no permissions
  });

  describe("Basic Rendering", () => {
    it("should render machine information correctly", () => {
      render(
        <VitestTestWrapper>
          <MachineDetailView
            machine={mockMachine}
            session={mockSession}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      // Header information
      expect(screen.getByText("Custom Machine Name")).toBeInTheDocument();
      expect(
        screen.getByText("Medieval Madness • Williams • 1997"),
      ).toBeInTheDocument();

      // Location information
      expect(screen.getByText("Test Location")).toBeInTheDocument();
      expect(screen.getByText("123 Test St, Austin, TX")).toBeInTheDocument();

      // Owner information
      expect(screen.getByText("John Doe")).toBeInTheDocument();

      // Model details
      expect(screen.getByText("Machine Information")).toBeInTheDocument();
      expect(screen.getByText("Model Details")).toBeInTheDocument();
    });

    it("should render QR code when available", () => {
      render(
        <VitestTestWrapper>
          <MachineDetailView
            machine={mockMachine}
            session={mockSession}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("QR Code")).toBeInTheDocument();
      expect(screen.getByText("Scan to report issues")).toBeInTheDocument();
      expect(screen.getByText(/Generated/)).toBeInTheDocument();

      const qrImage = screen.getByAltText("QR Code for Custom Machine Name");
      expect(qrImage).toBeInTheDocument();
      expect(qrImage).toHaveAttribute("src", "https://example.com/qr-code.png");
    });

    it("should show generate QR code button when QR code not available", () => {
      render(
        <VitestTestWrapper>
          <MachineDetailView
            machine={mockMachineWithoutQR}
            session={mockSession}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("QR code not available")).toBeInTheDocument();
    });

    it("should render external links when available", () => {
      render(
        <VitestTestWrapper>
          <MachineDetailView
            machine={mockMachine}
            session={mockSession}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("External Links")).toBeInTheDocument();

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

    it("should render statistics placeholder", () => {
      render(
        <VitestTestWrapper>
          <MachineDetailView
            machine={mockMachine}
            session={mockSession}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("Statistics")).toBeInTheDocument();
      expect(screen.getByText("Statistics coming soon")).toBeInTheDocument();
    });
  });

  describe("Permission-based Actions", () => {
    it("should show edit button when user has machines:edit permission", () => {
      mockHasPermission.mockImplementation(
        (permission: string) => permission === "machines:edit",
      );

      render(
        <VitestTestWrapper userPermissions={["machines:edit"]}>
          <MachineDetailView
            machine={mockMachine}
            session={mockSession}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      const editButton = screen.getByRole("button", { name: /edit/i });
      expect(editButton).toBeInTheDocument();
      expect(editButton).toBeEnabled();
    });

    it("should hide edit button when user lacks machines:edit permission", () => {
      mockHasPermission.mockReturnValue(false);

      render(
        <VitestTestWrapper userPermissions={[]}>
          <MachineDetailView
            machine={mockMachine}
            session={mockSession}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      expect(
        screen.queryByRole("button", { name: /edit/i }),
      ).not.toBeInTheDocument();
    });

    it("should show delete button when user has machines:delete permission", () => {
      mockHasPermission.mockImplementation(
        (permission: string) => permission === "machines:delete",
      );

      render(
        <VitestTestWrapper userPermissions={["machines:delete"]}>
          <MachineDetailView
            machine={mockMachine}
            session={mockSession}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      const deleteButton = screen.getByRole("button", { name: /delete/i });
      expect(deleteButton).toBeInTheDocument();
      expect(deleteButton).toBeEnabled();
    });

    it("should hide delete button when user lacks machines:delete permission", () => {
      mockHasPermission.mockReturnValue(false);

      render(
        <VitestTestWrapper userPermissions={[]}>
          <MachineDetailView
            machine={mockMachine}
            session={mockSession}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      expect(
        screen.queryByRole("button", { name: /delete/i }),
      ).not.toBeInTheDocument();
    });

    it("should show generate QR code button when user has machines:edit permission and QR code is missing", () => {
      mockHasPermission.mockImplementation(
        (permission: string) => permission === "machines:edit",
      );

      render(
        <VitestTestWrapper userPermissions={["machines:edit"]}>
          <MachineDetailView
            machine={mockMachineWithoutQR}
            session={mockSession}
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

    it("should hide generate QR code button when user lacks machines:edit permission", () => {
      mockHasPermission.mockReturnValue(false);

      render(
        <VitestTestWrapper userPermissions={[]}>
          <MachineDetailView
            machine={mockMachineWithoutQR}
            session={mockSession}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      expect(
        screen.queryByRole("button", { name: /generate qr code/i }),
      ).not.toBeInTheDocument();
    });

    it("should show all action buttons for admin users", () => {
      mockHasPermission.mockReturnValue(true); // Admin has all permissions

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
        >
          <MachineDetailView
            machine={mockMachineWithoutQR}
            session={mockSession}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /delete/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /generate qr code/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Conditional Content", () => {
    it("should handle machine without owner", () => {
      const machineWithoutOwner = {
        ...mockMachine,
        owner: null,
      };

      render(
        <VitestTestWrapper>
          <MachineDetailView
            machine={machineWithoutOwner}
            session={mockSession}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
      expect(screen.queryByText("Owner")).not.toBeInTheDocument();
    });

    it("should handle machine without custom name", () => {
      const machineWithoutName = {
        ...mockMachine,
        name: null,
      };

      render(
        <VitestTestWrapper>
          <MachineDetailView
            machine={machineWithoutName}
            session={mockSession}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      // Should use model name as the main title
      expect(
        screen.getByRole("heading", { name: "Medieval Madness" }),
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
        <VitestTestWrapper>
          <MachineDetailView
            machine={machineWithoutLinks}
            session={mockSession}
            machineId="machine-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.queryByText("External Links")).not.toBeInTheDocument();
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
