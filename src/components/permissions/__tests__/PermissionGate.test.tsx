/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";

import { PermissionGate } from "../PermissionGate";

describe("PermissionGate", () => {
  const mockHasPermission = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Permission Checking", () => {
    it("should render children when user has required permission", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate
          permission="test:permission"
          hasPermission={mockHasPermission}
        >
          <div data-testid="protected-content">Protected Content</div>
        </PermissionGate>,
      );

      expect(screen.getByTestId("protected-content")).toBeInTheDocument();
      expect(mockHasPermission).toHaveBeenCalledWith("test:permission");
    });

    it("should not render children when user lacks required permission", () => {
      mockHasPermission.mockReturnValue(false);

      render(
        <PermissionGate
          permission="test:permission"
          hasPermission={mockHasPermission}
        >
          <div data-testid="protected-content">Protected Content</div>
        </PermissionGate>,
      );

      expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
      expect(mockHasPermission).toHaveBeenCalledWith("test:permission");
    });
  });

  describe("Fallback Content", () => {
    it("should render fallback when showFallback is true and permission is denied", () => {
      mockHasPermission.mockReturnValue(false);

      render(
        <PermissionGate
          permission="test:permission"
          hasPermission={mockHasPermission}
          fallback={<div data-testid="fallback-content">Access Denied</div>}
          showFallback={true}
        >
          <div data-testid="protected-content">Protected Content</div>
        </PermissionGate>,
      );

      expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
      expect(screen.getByTestId("fallback-content")).toBeInTheDocument();
      expect(screen.getByText("Access Denied")).toBeInTheDocument();
    });

    it("should not render fallback when showFallback is false (default)", () => {
      mockHasPermission.mockReturnValue(false);

      render(
        <PermissionGate
          permission="test:permission"
          hasPermission={mockHasPermission}
          fallback={<div data-testid="fallback-content">Access Denied</div>}
        >
          <div data-testid="protected-content">Protected Content</div>
        </PermissionGate>,
      );

      expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
      expect(screen.queryByTestId("fallback-content")).not.toBeInTheDocument();
    });

    it("should not render fallback when showFallback is true but no fallback is provided", () => {
      mockHasPermission.mockReturnValue(false);

      render(
        <PermissionGate
          permission="test:permission"
          hasPermission={mockHasPermission}
          showFallback={true}
        >
          <div data-testid="protected-content">Protected Content</div>
        </PermissionGate>,
      );

      expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
      expect(document.body).toBeEmptyDOMElement();
    });

    it("should render children instead of fallback when permission is granted", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate
          permission="test:permission"
          hasPermission={mockHasPermission}
          fallback={<div data-testid="fallback-content">Access Denied</div>}
          showFallback={true}
        >
          <div data-testid="protected-content">Protected Content</div>
        </PermissionGate>,
      );

      expect(screen.getByTestId("protected-content")).toBeInTheDocument();
      expect(screen.queryByTestId("fallback-content")).not.toBeInTheDocument();
    });
  });

  describe("Different Permission Scenarios", () => {
    it("should handle issue permissions correctly", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate
          permission="issue:edit"
          hasPermission={mockHasPermission}
        >
          <button data-testid="edit-button">Edit Issue</button>
        </PermissionGate>,
      );

      expect(screen.getByTestId("edit-button")).toBeInTheDocument();
      expect(mockHasPermission).toHaveBeenCalledWith("issue:edit");
    });

    it("should handle admin permissions correctly", () => {
      mockHasPermission.mockReturnValue(false);

      render(
        <PermissionGate
          permission="organization:admin"
          hasPermission={mockHasPermission}
        >
          <div data-testid="admin-panel">Admin Panel</div>
        </PermissionGate>,
      );

      expect(screen.queryByTestId("admin-panel")).not.toBeInTheDocument();
      expect(mockHasPermission).toHaveBeenCalledWith("organization:admin");
    });

    it("should handle machine permissions correctly", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate
          permission="machine:create"
          hasPermission={mockHasPermission}
        >
          <button data-testid="create-machine">Add Machine</button>
        </PermissionGate>,
      );

      expect(screen.getByTestId("create-machine")).toBeInTheDocument();
      expect(mockHasPermission).toHaveBeenCalledWith("machine:create");
    });
  });

  describe("Complex Children", () => {
    it("should render complex nested children when permission is granted", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate
          permission="test:permission"
          hasPermission={mockHasPermission}
        >
          <div data-testid="parent">
            <h1>Title</h1>
            <div>
              <p>Some content</p>
              <button>Action Button</button>
            </div>
          </div>
        </PermissionGate>,
      );

      expect(screen.getByTestId("parent")).toBeInTheDocument();
      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Some content")).toBeInTheDocument();
      expect(screen.getByText("Action Button")).toBeInTheDocument();
    });

    it("should handle React fragments as children", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate
          permission="test:permission"
          hasPermission={mockHasPermission}
        >
          <>
            <span data-testid="fragment-child-1">First</span>
            <span data-testid="fragment-child-2">Second</span>
          </>
        </PermissionGate>,
      );

      expect(screen.getByTestId("fragment-child-1")).toBeInTheDocument();
      expect(screen.getByTestId("fragment-child-2")).toBeInTheDocument();
    });

    it("should handle multiple children", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate
          permission="test:permission"
          hasPermission={mockHasPermission}
        >
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </PermissionGate>,
      );

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty permission string", () => {
      mockHasPermission.mockReturnValue(false);

      render(
        <PermissionGate permission="" hasPermission={mockHasPermission}>
          <div data-testid="content">Content</div>
        </PermissionGate>,
      );

      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
      expect(mockHasPermission).toHaveBeenCalledWith("");
    });

    it("should handle null children gracefully", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate
          permission="test:permission"
          hasPermission={mockHasPermission}
        >
          {null}
        </PermissionGate>,
      );

      // Should not crash and render nothing
      expect(document.body).toBeEmptyDOMElement();
    });

    it("should handle undefined children gracefully", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate
          permission="test:permission"
          hasPermission={mockHasPermission}
        >
          {undefined}
        </PermissionGate>,
      );

      // Should not crash and render nothing
      expect(document.body).toBeEmptyDOMElement();
    });

    it("should handle false children gracefully", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate
          permission="test:permission"
          hasPermission={mockHasPermission}
        >
          {false}
        </PermissionGate>,
      );

      // Should not crash and render nothing
      expect(document.body).toBeEmptyDOMElement();
    });

    it("should handle string children", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate
          permission="test:permission"
          hasPermission={mockHasPermission}
        >
          Simple text content
        </PermissionGate>,
      );

      expect(screen.getByText("Simple text content")).toBeInTheDocument();
    });

    it("should handle number children", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate
          permission="test:permission"
          hasPermission={mockHasPermission}
        >
          {42}
        </PermissionGate>,
      );

      expect(screen.getByText("42")).toBeInTheDocument();
    });
  });

  describe("Permission Function Behavior", () => {
    it("should call hasPermission exactly once per render", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionGate
          permission="test:permission"
          hasPermission={mockHasPermission}
        >
          <div>Content</div>
        </PermissionGate>,
      );

      expect(mockHasPermission).toHaveBeenCalledTimes(1);
      expect(mockHasPermission).toHaveBeenCalledWith("test:permission");
    });

    it("should handle hasPermission function that throws", () => {
      mockHasPermission.mockImplementation(() => {
        throw new Error("Permission check failed");
      });

      // Should not crash the component - React error boundary would handle this in practice
      expect(() => {
        render(
          <PermissionGate
            permission="test:permission"
            hasPermission={mockHasPermission}
          >
            <div>Content</div>
          </PermissionGate>,
        );
      }).toThrow("Permission check failed");
    });

    it("should handle hasPermission function that returns non-boolean", () => {
      mockHasPermission.mockReturnValue("truthy" as any);

      render(
        <PermissionGate
          permission="test:permission"
          hasPermission={mockHasPermission}
        >
          <div data-testid="content">Content</div>
        </PermissionGate>,
      );

      // Truthy value should allow rendering
      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("should handle hasPermission function that returns falsy non-boolean", () => {
      mockHasPermission.mockReturnValue(0 as any);

      render(
        <PermissionGate
          permission="test:permission"
          hasPermission={mockHasPermission}
        >
          <div data-testid="content">Content</div>
        </PermissionGate>,
      );

      // Falsy value should prevent rendering
      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
    });
  });

  describe("Real-world Usage Patterns", () => {
    it("should work with typical permission checking patterns", () => {
      const userPermissions = ["issue:view", "issue:edit", "machine:view"];
      const hasPermission = (permission: string) =>
        userPermissions.includes(permission);

      render(
        <PermissionGate permission="issue:edit" hasPermission={hasPermission}>
          <button data-testid="edit-button">Edit Issue</button>
        </PermissionGate>,
      );

      expect(screen.getByTestId("edit-button")).toBeInTheDocument();
    });

    it("should work with permission checking that returns false", () => {
      const userPermissions = ["issue:view"];
      const hasPermission = (permission: string) =>
        userPermissions.includes(permission);

      render(
        <PermissionGate permission="issue:delete" hasPermission={hasPermission}>
          <button data-testid="delete-button">Delete Issue</button>
        </PermissionGate>,
      );

      expect(screen.queryByTestId("delete-button")).not.toBeInTheDocument();
    });

    it("should work in nested scenarios", () => {
      const userPermissions = ["admin:view", "admin:edit"];
      const hasPermission = (permission: string) =>
        userPermissions.includes(permission);

      render(
        <PermissionGate permission="admin:view" hasPermission={hasPermission}>
          <div data-testid="admin-panel">
            <h2>Admin Panel</h2>
            <PermissionGate
              permission="admin:edit"
              hasPermission={hasPermission}
            >
              <button data-testid="admin-edit">Edit Settings</button>
            </PermissionGate>
            <PermissionGate
              permission="admin:delete"
              hasPermission={hasPermission}
            >
              <button data-testid="admin-delete">Delete Data</button>
            </PermissionGate>
          </div>
        </PermissionGate>,
      );

      expect(screen.getByTestId("admin-panel")).toBeInTheDocument();
      expect(screen.getByText("Admin Panel")).toBeInTheDocument();
      expect(screen.getByTestId("admin-edit")).toBeInTheDocument();
      expect(screen.queryByTestId("admin-delete")).not.toBeInTheDocument();
    });
  });
});
