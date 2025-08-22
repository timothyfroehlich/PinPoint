/**
 * TEMPLATE: Archetype 4 - React Component Unit Test
 *
 * USE FOR: Testing React components with UI behavior and interactions
 * RLS IMPACT: None (UI components don't directly interact with RLS)
 * AGENT: unit-test-architect
 *
 * CHARACTERISTICS:
 * - Tests React component rendering and behavior
 * - Uses React Testing Library for user-centric testing
 * - Mocks external dependencies and data fetching
 * - Tests user interactions and state changes
 * - Uses MSW-tRPC for API mocking
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VitestTestWrapper } from "~/test/VitestTestWrapper";

// Import the component to test
// import { YourComponent } from "../YourComponent";

// Mock external dependencies
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/test-path",
}));

describe("YourComponent", () => {
  // =============================================================================
  // BASIC RENDERING TESTS
  // =============================================================================

  test("renders without crashing", () => {
    render(
      <VitestTestWrapper>
        <YourComponent />
      </VitestTestWrapper>,
    );

    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  test("displays correct initial content", () => {
    const props = {
      title: "Test Component",
      description: "This is a test component",
      items: ["Item 1", "Item 2", "Item 3"],
    };

    render(
      <VitestTestWrapper>
        <YourComponent {...props} />
      </VitestTestWrapper>,
    );

    expect(
      screen.getByRole("heading", { name: "Test Component" }),
    ).toBeInTheDocument();
    expect(screen.getByText("This is a test component")).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  test("handles empty/undefined props gracefully", () => {
    render(
      <VitestTestWrapper>
        <YourComponent />
      </VitestTestWrapper>,
    );

    // Component should render without errors even with missing props
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  // =============================================================================
  // CONDITIONAL RENDERING TESTS
  // =============================================================================

  test("shows loading state when data is loading", () => {
    render(
      <VitestTestWrapper>
        <YourComponent isLoading={true} />
      </VitestTestWrapper>,
    );

    expect(
      screen.getByRole("status", { name: /loading/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
  });

  test("shows error state when there is an error", () => {
    const errorMessage = "Failed to load data";

    render(
      <VitestTestWrapper>
        <YourComponent error={errorMessage} />
      </VitestTestWrapper>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  test("shows empty state when no data available", () => {
    render(
      <VitestTestWrapper>
        <YourComponent items={[]} />
      </VitestTestWrapper>,
    );

    expect(screen.getByText(/no items available/i)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  // =============================================================================
  // USER INTERACTION TESTS
  // =============================================================================

  test("handles button click events", async () => {
    const user = userEvent.setup();
    const mockOnClick = vi.fn();

    render(
      <VitestTestWrapper>
        <YourComponent onButtonClick={mockOnClick} />
      </VitestTestWrapper>,
    );

    const button = screen.getByRole("button", { name: /click me/i });
    await user.click(button);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
    expect(mockOnClick).toHaveBeenCalledWith(expect.any(Object)); // Event object
  });

  test("handles form submission", async () => {
    const user = userEvent.setup();
    const mockOnSubmit = vi.fn();

    render(
      <VitestTestWrapper>
        <YourComponent onSubmit={mockOnSubmit} />
      </VitestTestWrapper>,
    );

    // Fill out form fields
    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole("button", { name: /submit/i });

    await user.type(nameInput, "John Doe");
    await user.type(emailInput, "john@example.com");
    await user.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    expect(mockOnSubmit).toHaveBeenCalledWith({
      name: "John Doe",
      email: "john@example.com",
    });
  });

  test("handles input changes and updates state", async () => {
    const user = userEvent.setup();

    render(
      <VitestTestWrapper>
        <YourComponent />
      </VitestTestWrapper>,
    );

    const searchInput = screen.getByRole("textbox", { name: /search/i });

    await user.type(searchInput, "test query");

    expect(searchInput).toHaveValue("test query");

    // Verify search results or filtered content appears
    await waitFor(() => {
      expect(
        screen.getByText(/showing results for "test query"/i),
      ).toBeInTheDocument();
    });
  });

  // =============================================================================
  // ACCESSIBILITY TESTS
  // =============================================================================

  test("has proper accessibility attributes", () => {
    render(
      <VitestTestWrapper>
        <YourComponent />
      </VitestTestWrapper>,
    );

    // Check for proper ARIA labels
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label");

    // Check for proper heading hierarchy
    const headings = screen.getAllByRole("heading");
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAttribute("aria-level", "1");

    // Check for proper focus management
    const interactiveElements = screen.getAllByRole("button");
    interactiveElements.forEach((element) => {
      expect(element).toHaveAttribute("tabIndex", "0");
    });
  });

  test("supports keyboard navigation", async () => {
    const user = userEvent.setup();
    const mockOnSelect = vi.fn();

    render(
      <VitestTestWrapper>
        <YourComponent
          onItemSelect={mockOnSelect}
          items={["Item 1", "Item 2", "Item 3"]}
        />
      </VitestTestWrapper>,
    );

    // Focus first item
    const firstItem = screen.getByRole("option", { name: "Item 1" });
    firstItem.focus();

    // Navigate with arrow keys
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "Item 2" })).toHaveFocus();

    // Select with Enter key
    await user.keyboard("{Enter}");
    expect(mockOnSelect).toHaveBeenCalledWith("Item 2");
  });

  // =============================================================================
  // DATA FETCHING AND MOCKING TESTS
  // =============================================================================

  test("displays data from tRPC query", async () => {
    // Mock tRPC response using MSW-tRPC
    const mockData = [
      { id: "1", name: "Test Item 1", status: "active" },
      { id: "2", name: "Test Item 2", status: "inactive" },
    ];

    // This assumes you have MSW-tRPC setup in VitestTestWrapper
    render(
      <VitestTestWrapper
        trpcMocks={{
          yourRouter: {
            getItems: mockData,
          },
        }}
      >
        <YourComponent />
      </VitestTestWrapper>,
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText("Test Item 1")).toBeInTheDocument();
      expect(screen.getByText("Test Item 2")).toBeInTheDocument();
    });

    // Verify data is displayed correctly
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  test("handles tRPC mutation calls", async () => {
    const user = userEvent.setup();
    const mockMutate = vi
      .fn()
      .mockResolvedValue({ id: "new-1", name: "New Item" });

    render(
      <VitestTestWrapper
        trpcMocks={{
          yourRouter: {
            createItem: mockMutate,
          },
        }}
      >
        <YourComponent />
      </VitestTestWrapper>,
    );

    // Fill form and submit
    const nameInput = screen.getByLabelText(/item name/i);
    const submitButton = screen.getByRole("button", { name: /create/i });

    await user.type(nameInput, "New Test Item");
    await user.click(submitButton);

    // Verify mutation was called
    expect(mockMutate).toHaveBeenCalledWith({
      name: "New Test Item",
    });

    // Verify success message appears
    await waitFor(() => {
      expect(
        screen.getByText(/item created successfully/i),
      ).toBeInTheDocument();
    });
  });

  // =============================================================================
  // RESPONSIVE AND VISUAL BEHAVIOR TESTS
  // =============================================================================

  test("adapts to different screen sizes", () => {
    const { rerender } = render(
      <VitestTestWrapper>
        <YourComponent />
      </VitestTestWrapper>,
    );

    // Test mobile view
    Object.defineProperty(window, "innerWidth", { value: 375 });
    window.dispatchEvent(new Event("resize"));

    rerender(
      <VitestTestWrapper>
        <YourComponent />
      </VitestTestWrapper>,
    );

    // Verify mobile-specific elements
    expect(screen.getByRole("button", { name: /menu/i })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeVisible();

    // Test desktop view
    Object.defineProperty(window, "innerWidth", { value: 1024 });
    window.dispatchEvent(new Event("resize"));

    rerender(
      <VitestTestWrapper>
        <YourComponent />
      </VitestTestWrapper>,
    );

    // Verify desktop-specific elements
    expect(
      screen.queryByRole("button", { name: /menu/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeVisible();
  });

  test("shows correct visual states", async () => {
    const user = userEvent.setup();

    render(
      <VitestTestWrapper>
        <YourComponent />
      </VitestTestWrapper>,
    );

    const toggleButton = screen.getByRole("button", { name: /toggle/i });

    // Initial state
    expect(toggleButton).toHaveAttribute("aria-pressed", "false");
    expect(toggleButton).not.toHaveClass("active");

    // After toggle
    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-pressed", "true");
    expect(toggleButton).toHaveClass("active");
  });

  // =============================================================================
  // ERROR BOUNDARY AND EDGE CASE TESTS
  // =============================================================================

  test("handles component errors gracefully", () => {
    // Mock console.error to prevent test output pollution
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const ThrowingComponent = () => {
      throw new Error("Test error");
    };

    render(
      <VitestTestWrapper>
        <YourComponent>
          <ThrowingComponent />
        </YourComponent>
      </VitestTestWrapper>,
    );

    // Verify error boundary displays fallback UI
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  test("handles invalid prop types", () => {
    // Test with invalid props to ensure component doesn't crash
    const invalidProps = {
      items: "not an array", // Should be array
      count: "not a number", // Should be number
      onSelect: "not a function", // Should be function
    } as any;

    render(
      <VitestTestWrapper>
        <YourComponent {...invalidProps} />
      </VitestTestWrapper>,
    );

    // Component should render fallback content or handle gracefully
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  // =============================================================================
  // COMPLEX INTERACTION SCENARIOS
  // =============================================================================

  test("handles complex user workflows", async () => {
    const user = userEvent.setup();
    const mockOnComplete = vi.fn();

    render(
      <VitestTestWrapper>
        <YourComponent onWorkflowComplete={mockOnComplete} />
      </VitestTestWrapper>,
    );

    // Step 1: Select an option
    const selectElement = screen.getByRole("combobox", { name: /category/i });
    await user.selectOptions(selectElement, "category-1");

    // Step 2: Fill additional form based on selection
    await waitFor(() => {
      expect(
        screen.getByLabelText(/details for category 1/i),
      ).toBeInTheDocument();
    });

    const detailsInput = screen.getByLabelText(/details for category 1/i);
    await user.type(detailsInput, "Specific details");

    // Step 3: Confirm and submit
    const confirmButton = screen.getByRole("button", { name: /confirm/i });
    await user.click(confirmButton);

    const submitButton = screen.getByRole("button", { name: /submit/i });
    await user.click(submitButton);

    // Verify workflow completion
    expect(mockOnComplete).toHaveBeenCalledWith({
      category: "category-1",
      details: "Specific details",
    });
  });
});

// =============================================================================
// TEMPLATE USAGE INSTRUCTIONS
// =============================================================================

/*
SETUP INSTRUCTIONS:

1. Replace 'YourComponent' with your actual component name
2. Update import paths to match your component location
3. Replace mock props with your component's actual prop types
4. Customize test scenarios for your component's functionality
5. Update tRPC mock setup for your actual API routes
6. Remove unused test cases

REACT COMPONENT TEST CHARACTERISTICS:
- Tests UI rendering and visual behavior
- Tests user interactions and event handling
- Tests accessibility and keyboard navigation
- Tests data fetching integration with tRPC
- Tests responsive behavior and conditional rendering

WHEN TO USE THIS TEMPLATE:
✅ Testing React components with UI interactions
✅ Testing form components with user input
✅ Testing data display components with tRPC integration
✅ Testing component state changes and behavior
✅ Testing accessibility and keyboard navigation

WHEN NOT TO USE:
❌ Testing pure functions (use Archetype 1)
❌ Testing service layer logic (use Archetype 2) 
❌ Testing database operations (use Archetype 3)
❌ Testing tRPC routers (use Archetype 5)

TESTING LIBRARY BEST PRACTICES:
✅ Test user behavior, not implementation details
✅ Use accessible queries (getByRole, getByLabelText)
✅ Test from the user's perspective
✅ Mock external dependencies appropriately
✅ Focus on component contract, not internal state

EXAMPLE COMPONENTS SUITABLE FOR THIS TEMPLATE:
- IssueList: Display and filter issues
- MachineCard: Display machine information with actions
- UserProfile: User information form with validation
- Dashboard: Complex UI with multiple data sources
- Navigation: Menu components with routing
*/
