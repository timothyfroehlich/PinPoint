/**
 * {{COMPONENT_NAME}} Client Island Tests - Archetype 3
 * Minimal interactive components with server-passed props
 * 
 * ARCHETYPE BOUNDARIES:
 * - Test Client Components that provide specific interactivity within RSC architecture
 * - Focus on server prop integration, user interactions, and progressive enhancement
 * - Mock Server Actions and external dependencies for isolated component testing
 * - NO server-side data fetching (that belongs in Server Component archetype)
 * 
 * WHAT BELONGS HERE:
 * - Client Components marked with "use client" directive
 * - Interactive form controls, search inputs, toggle buttons, modals
 * - Components that manage local UI state or handle user events
 * - Progressive enhancement patterns that work without JavaScript
 * 
 * WHAT DOESN'T BELONG:
 * - Server Components that fetch data (use Server Component archetype)
 * - Pure utility functions (use Unit archetype)
 * - Server Actions (use Server Action archetype)
 * - Full page workflows (use E2E archetype)
 * 
 * SERVER PROP INTEGRATION:
 * - Client Islands receive data from Server Components as props
 * - Test that components properly render server-provided data
 * - Verify component behavior when server props change
 * - Ensure proper type safety between server and client boundaries
 * 
 * PROGRESSIVE ENHANCEMENT:
 * - Components should gracefully degrade when JavaScript is disabled
 * - Test fallback UI states and server-only functionality
 * - Verify that essential functionality works without client-side JavaScript
 * - Ensure forms submit properly through Server Actions without JS
 * 
 * MINIMAL STATE MANAGEMENT:
 * - Client Islands should manage only UI-specific local state
 * - Avoid complex state management that belongs in Server Components
 * - Test state synchronization with server props and updates
 * - Focus on immediate user feedback and optimistic updates
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { GENERATED_MOCKS } from "~/test/generated/mocks";
import { {{COMPONENT_NAME}} } from "{{MODULE_PATH}}";

describe("{{COMPONENT_NAME}} (Client Island Tests - Archetype 3)", () => {
  // Server-passed props from Server Components
  const mockServerProps = {
    {{SERVER_PROP_1}}: GENERATED_MOCKS.{{ENTITY_TYPE}}.{{MOCK_INSTANCE}},
    {{SERVER_PROP_2}}: SEED_TEST_IDS.{{CONSTANT_TYPE}}.{{CONSTANT_VALUE}},
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Server prop integration", () => {
    it("renders with server-passed data correctly", () => {
      const mockOnAction = vi.fn();
      
      render(
        <{{COMPONENT_NAME}} 
          {...mockServerProps}
          onAction={mockOnAction}
        />
      );

      // Verify server data is displayed
      expect(screen.getByText("{{EXPECTED_DISPLAY_TEXT}}")).toBeInTheDocument();
      expect(screen.getByTestId("{{TEST_ID}}")).toBeInTheDocument();
    });

    it("validates server prop structure", () => {
      const mockOnAction = vi.fn();
      
      render(
        <{{COMPONENT_NAME}} 
          {...mockServerProps}
          onAction={mockOnAction}
        />
      );

      // Verify component receives and uses server props
      const element = screen.getByTestId("{{DATA_TEST_ID}}");
      expect(element).toHaveAttribute("data-{{SERVER_PROP_1}}", mockServerProps.{{SERVER_PROP_1}}.{{PROP_FIELD}});
      expect(element).toHaveAttribute("data-organization-id", SEED_TEST_IDS.ORGANIZATIONS.primary);
    });

    it("handles missing optional server props gracefully", () => {
      const mockOnAction = vi.fn();
      const minimalProps = {
        {{REQUIRED_SERVER_PROP}}: mockServerProps.{{REQUIRED_SERVER_PROP}},
        onAction: mockOnAction
      };
      
      render(<{{COMPONENT_NAME}} {...minimalProps} />);

      // Should render without crashing
      expect(screen.getByTestId("{{TEST_ID}}")).toBeInTheDocument();
    });
  });

  describe("User interactions", () => {
    it("handles {{PRIMARY_INTERACTION}} correctly", async () => {
      const user = userEvent.setup();
      const mockOnAction = vi.fn();
      
      render(
        <{{COMPONENT_NAME}} 
          {...mockServerProps}
          onAction={mockOnAction}
        />
      );

      const {{INTERACTION_ELEMENT}} = screen.getByRole("{{ELEMENT_ROLE}}", { name: "{{ELEMENT_NAME}}" });
      await user.{{USER_ACTION}}({{INTERACTION_ELEMENT}});

      expect(mockOnAction).toHaveBeenCalledWith({
        type: "{{ACTION_TYPE}}",
        {{ACTION_DATA}}: {{EXPECTED_ACTION_VALUE}},
      });
    });

    it("handles form submission with validation", async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      
      render(
        <{{COMPONENT_NAME}} 
          {...mockServerProps}
          onSubmit={mockOnSubmit}
        />
      );

      // Fill form fields
      const {{INPUT_FIELD}} = screen.getByLabelText("{{INPUT_LABEL}}");
      await user.type({{INPUT_FIELD}}, "{{TEST_INPUT_VALUE}}");

      // Submit form
      const submitButton = screen.getByRole("button", { name: "{{SUBMIT_BUTTON_TEXT}}" });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          {{FORM_FIELD}}: "{{TEST_INPUT_VALUE}}",
          {{SERVER_CONTEXT_FIELD}}: mockServerProps.{{SERVER_PROP_1}}.id,
        });
      });
    });

    it("validates user input before submission", async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      
      render(
        <{{COMPONENT_NAME}} 
          {...mockServerProps}
          onSubmit={mockOnSubmit}
        />
      );

      // Submit with empty/invalid input
      const submitButton = screen.getByRole("button", { name: "{{SUBMIT_BUTTON_TEXT}}" });
      await user.click(submitButton);

      // Should show validation error
      expect(screen.getByText("{{VALIDATION_ERROR_TEXT}}")).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("provides immediate user feedback", async () => {
      const user = userEvent.setup();
      const mockOnAction = vi.fn();
      
      render(
        <{{COMPONENT_NAME}} 
          {...mockServerProps}
          onAction={mockOnAction}
        />
      );

      const actionButton = screen.getByRole("button", { name: "{{ACTION_BUTTON_TEXT}}" });
      await user.click(actionButton);

      // Should show loading/feedback state
      expect(screen.getByText("{{LOADING_TEXT}}")).toBeInTheDocument();
      expect(actionButton).toBeDisabled();
    });
  });

  describe("State management (minimal)", () => {
    it("manages local UI state correctly", async () => {
      const user = userEvent.setup();
      
      render(
        <{{COMPONENT_NAME}} 
          {...mockServerProps}
          onAction={vi.fn()}
        />
      );

      // Toggle UI state
      const toggleButton = screen.getByRole("button", { name: "{{TOGGLE_BUTTON_TEXT}}" });
      await user.click(toggleButton);

      // Verify state change reflected in UI
      expect(screen.getByText("{{TOGGLED_STATE_TEXT}}")).toBeInTheDocument();
      
      // Toggle back
      await user.click(toggleButton);
      expect(screen.getByText("{{DEFAULT_STATE_TEXT}}")).toBeInTheDocument();
    });

    it("resets state on server prop changes", () => {
      const { rerender } = render(
        <{{COMPONENT_NAME}} 
          {...mockServerProps}
          onAction={vi.fn()}
        />
      );

      // Change server props (simulating server-side update)
      const updatedProps = {
        ...mockServerProps,
        {{SERVER_PROP_1}}: { 
          ...mockServerProps.{{SERVER_PROP_1}}, 
          {{UPDATABLE_FIELD}}: "{{UPDATED_VALUE}}" 
        }
      };

      rerender(
        <{{COMPONENT_NAME}} 
          {...updatedProps}
          onAction={vi.fn()}
        />
      );

      // Should reflect updated server data
      expect(screen.getByText("{{UPDATED_DISPLAY_TEXT}}")).toBeInTheDocument();
    });
  });

  describe("Accessibility patterns", () => {
    it("provides proper keyboard navigation", async () => {
      const user = userEvent.setup();
      const mockOnAction = vi.fn();
      
      render(
        <{{COMPONENT_NAME}} 
          {...mockServerProps}
          onAction={mockOnAction}
        />
      );

      // Tab through interactive elements
      await user.tab();
      expect(screen.getByRole("{{FIRST_FOCUSABLE_ROLE}}")).toHaveFocus();

      await user.tab();
      expect(screen.getByRole("{{SECOND_FOCUSABLE_ROLE}}")).toHaveFocus();

      // Activate with keyboard
      await user.keyboard("{Enter}");
      expect(mockOnAction).toHaveBeenCalled();
    });

    it("provides proper ARIA labels and descriptions", () => {
      render(
        <{{COMPONENT_NAME}} 
          {...mockServerProps}
          onAction={vi.fn()}
        />
      );

      const interactiveElement = screen.getByRole("{{ELEMENT_ROLE}}");
      expect(interactiveElement).toHaveAttribute("aria-label", "{{ARIA_LABEL}}");
      expect(interactiveElement).toHaveAttribute("aria-describedby");
    });

    it("announces state changes to screen readers", async () => {
      const user = userEvent.setup();
      
      render(
        <{{COMPONENT_NAME}} 
          {...mockServerProps}
          onAction={vi.fn()}
        />
      );

      const button = screen.getByRole("button", { name: "{{ACTION_BUTTON_TEXT}}" });
      await user.click(button);

      // Should have aria-live region with status update
      expect(screen.getByRole("status")).toHaveTextContent("{{STATUS_UPDATE_TEXT}}");
    });
  });

  describe("Error handling", () => {
    it("handles action errors gracefully", async () => {
      const user = userEvent.setup();
      const mockOnAction = vi.fn().mockRejectedValue(new Error("{{ERROR_MESSAGE}}"));
      
      render(
        <{{COMPONENT_NAME}} 
          {...mockServerProps}
          onAction={mockOnAction}
        />
      );

      const actionButton = screen.getByRole("button", { name: "{{ACTION_BUTTON_TEXT}}" });
      await user.click(actionButton);

      await waitFor(() => {
        expect(screen.getByText("{{ERROR_DISPLAY_TEXT}}")).toBeInTheDocument();
      });

      // Button should be re-enabled after error
      expect(actionButton).not.toBeDisabled();
    });

    it("handles network failures with retry option", async () => {
      const user = userEvent.setup();
      const mockOnAction = vi.fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ success: true });
      
      render(
        <{{COMPONENT_NAME}} 
          {...mockServerProps}
          onAction={mockOnAction}
        />
      );

      const actionButton = screen.getByRole("button", { name: "{{ACTION_BUTTON_TEXT}}" });
      await user.click(actionButton);

      // Should show retry option after error
      await waitFor(() => {
        expect(screen.getByText("{{RETRY_BUTTON_TEXT}}")).toBeInTheDocument();
      });

      const retryButton = screen.getByText("{{RETRY_BUTTON_TEXT}}");
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText("{{SUCCESS_MESSAGE}}")).toBeInTheDocument();
      });

      expect(mockOnAction).toHaveBeenCalledTimes(2);
    });
  });

  describe("Progressive enhancement", () => {
    it("works with server-only functionality", () => {
      // Test that component renders and displays server data even without interactions
      render(
        <{{COMPONENT_NAME}} 
          {...mockServerProps}
          // No onAction prop - simulating no-JS scenario
        />
      );

      // Should still display server-provided content
      expect(screen.getByText("{{FALLBACK_DISPLAY_TEXT}}")).toBeInTheDocument();
      expect(screen.getByTestId("{{FALLBACK_TEST_ID}}")).toBeInTheDocument();
    });

    it("gracefully handles missing JavaScript functionality", () => {
      const mockOnAction = undefined; // Simulate missing JS handler
      
      render(
        <{{COMPONENT_NAME}} 
          {...mockServerProps}
          onAction={mockOnAction}
        />
      );

      // Interactive elements should either be hidden or show fallback
      const actionElements = screen.queryAllByRole("button");
      actionElements.forEach(element => {
        // Should either not exist or be properly disabled/labeled for fallback
        if (element) {
          expect(element).toHaveAttribute("disabled");
        }
      });
    });
  });
});

// Example usage patterns for different Client Island types:

/*
// Search/Filter components:
describe("SearchInput (Client Island)", () => {
  // Test debounced search, real-time filtering, URL state sync
  // Server props: initialQuery, organizationId, availableFilters
  // Interactions: typing, filter selection, clear search
});

// Form components with optimistic updates:
describe("CommentForm (Client Island)", () => {
  // Test form validation, optimistic updates, error handling
  // Server props: entityId, currentUser, existingComments
  // Interactions: text input, submit, cancel, retry
});

// Toggle/Status components:
describe("StatusDropdown (Client Island)", () => {
  // Test status changes, permission checks, immediate feedback
  // Server props: currentStatus, availableStatuses, permissions
  // Interactions: dropdown selection, confirmation, rollback
});

// Interactive tables/lists:
describe("SelectableTable (Client Island)", () => {
  // Test row selection, bulk actions, sorting state
  // Server props: data, columns, initialSort, permissions
  // Interactions: checkbox selection, sort clicks, bulk operations
});

// Real-time components:
describe("NotificationBell (Client Island)", () => {
  // Test WebSocket connections, notification display, mark as read
  // Server props: initialNotifications, unreadCount, userId
  // Interactions: click to open, mark read, dismiss
});
*/