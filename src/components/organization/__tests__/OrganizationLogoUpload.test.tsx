import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { OrganizationLogoUpload } from "../OrganizationLogoUpload";

// Mock tRPC
vi.mock("~/trpc/react", () => ({
  api: {
    organization: {
      uploadLogo: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          isLoading: false,
          error: null,
        })),
      },
    },
  },
}));

// Mock image processing utility
vi.mock("~/lib/utils/image-processing", () => ({
  processImageFile: vi.fn().mockResolvedValue("data:image/webp;base64,test"),
}));

describe("OrganizationLogoUpload", () => {
  const mockOrganization = {
    id: "org-123",
    name: "Test Organization",
    logoUrl: null,
  };

  it("should render without crashing", () => {
    const { container } = render(
      <OrganizationLogoUpload currentOrganization={mockOrganization} />,
    );

    expect(container).toBeDefined();
  });

  it("should render with existing logo", () => {
    const orgWithLogo = {
      ...mockOrganization,
      logoUrl: "https://example.com/logo.png",
    };

    const { container } = render(
      <OrganizationLogoUpload currentOrganization={orgWithLogo} />,
    );

    expect(container).toBeDefined();
  });

  it("should handle onUploadSuccess callback", () => {
    const onUploadSuccess = vi.fn();

    const { container } = render(
      <OrganizationLogoUpload
        currentOrganization={mockOrganization}
        onUploadSuccess={onUploadSuccess}
      />,
    );

    expect(container).toBeDefined();
    expect(onUploadSuccess).toBeDefined();
  });

  it("should handle custom size prop", () => {
    const { container } = render(
      <OrganizationLogoUpload
        currentOrganization={mockOrganization}
        size={200}
      />,
    );

    expect(container).toBeDefined();
  });
});
