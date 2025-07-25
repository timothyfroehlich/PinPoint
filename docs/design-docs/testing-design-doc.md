---
status: current
last-updated: 2025-01-14
---

# Testing Design Document

**CURRENT PHASE: Unit Tests Only - Rapid Iteration Mode**

This document outlines our testing strategy during the current rapid iteration phase. We are focusing exclusively on **unit tests** for business logic while deferring integration and end-to-end tests until the core functionality stabilizes.

## Code Coverage Requirements

The project enforces the following minimum coverage thresholds:

- **Global**: 50% minimum coverage
- **server/**: 60% minimum coverage
- **lib/**: 70% minimum coverage

Coverage is tracked via Codecov integration with GitHub Actions. See [coverage-setup.md](../coverage-setup.md) for implementation details.

### 1\\. Current Testing Philosophy

During rapid development, we prioritize fast feedback and quick iteration:

- **Guiding Principles:**
  - **Unit Tests Only:** Focus on testing business logic in isolation with mocked dependencies
  - **Fast Feedback:** Tests must be fast (no real I/O, databases, or network calls)
  - **Business Logic First:** Test the core logic that drives the application
  - **Multi-Tenancy Critical:** Always verify organization isolation in business logic
  - **Code Quality:** TypeScript for static type checking, ESLint and Prettier enforced through pre-commit hooks
  - **Test Quality:** Test code must meet the same quality standards as production code
  - **No `any` Types:** Tests should use proper TypeScript types, including typed mocks
- **Current Technology Stack:**
  - **Unit Testing:** **Vitest** as test runner for service layer and utility functions
  - **Mocking:** Vitest's built-in mocking with typed mocks (`vi.fn<T>()`) and custom utilities
  - **Fixtures:** Static test data to ensure consistent test scenarios
  - **ESM Support:** Native ES module support without transformation overhead
  - **Coverage:** Vitest with v8 provider for accurate coverage metrics
- **Future Technology Stack (Deferred):**
  - **Integration Testing:** React Testing Library for components, direct tRPC procedure calls
  - **End-to-End Testing:** Playwright for browser automation
  - **Service Mocking:** Mock Service Worker (MSW) for API simulation

### 2\\. What We Test Now vs Later

### ✅ CURRENT: Unit Tests Only

> **Note**: All test files must use ESM syntax and may require special handling for ESM-only packages like `superjson` or `@auth/prisma-adapter`.

**Service Layer (\*\***`src/server/services/`\***\*)**

- Business logic functions (PinballMap sync, data processing)
- Data transformation and validation
- Multi-tenancy isolation logic
- Error handling and edge cases
- API client libraries with mocked responses

**Examples of Current Tests:**

- `src/server/services/__tests__/pinballmapService.test.ts` - Core sync business logic
- `src/lib/pinballmap/__tests__/client.test.ts` - API client with fixture data
- `src/server/api/__tests__/` - tRPC procedure tests with mocked Prisma client

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests for CI (with coverage)
npm run test:ci
```

### ❌ DEFERRED: Integration & E2E Tests

**Integration Tests (Coming Later):**

- tRPC procedure end-to-end behavior
- Database integration with real connections
- Authentication and authorization flows
- Multi-step workflows

**End-to-End Tests (Coming Later):**

- Full user workflows through the UI
- Cross-browser compatibility
- Performance testing

### 3\\. Testing Strategy by Development Phase

### Tests for Milestone 1: Foundational Backend

- **Focus:** Backend logic, database integrity, and security.
- **Unit Tests:**
  - Test individual utility functions and helper classes in isolation.
  - Test NextAuth.js configuration and authentication callback logic, mocking database and provider dependencies.
- **Integration Tests:**
  - **API Procedure Testing (Critical):** Write tests for all authentication-related tRPC procedures to validate user creation, login, and session handling.
  - **Multi-Tenancy Validation (Highest Priority):** Create a dedicated test suite to rigorously verify data segregation. These tests will seed a test database with data for multiple organizations and assert that tRPC procedures called with the context of `Organization A` can **never** read, update, or delete data belonging to `Organization B`.

### Tests for Milestone 2: MVP

- **Focus:** Core user workflows and the interaction between the frontend and backend.
- **Unit Tests (React Testing Library):**
  - Test individual UI components to ensure they render correctly based on props (e.g., `<IssueCard>`, `<SubmissionForm>`).
  - Test client-side form validation and state management logic.
- **Integration Tests:**
  - Test the full data flow from the UI to the database. For example, a test will simulate filling out and submitting the issue form, mocking the tRPC procedure call to verify the correct payload is sent, and asserting the UI updates accordingly.
  - Write integration tests for all new CRUD tRPC procedures related to `Machines` and `Issues`.
- **End-to-End Tests (Playwright):**
  - **Public User Flow:** Automate a browser to navigate to the site, view the public issue dashboard, select a game, submit a new issue, and verify that the new issue appears on the dashboard and the game's status page.
  - **Admin User Flow:** Automate a login as an `Admin`, navigate to the admin panel, create a new `Machine`, find a submitted issue, and update its status. The test will then assert that the change is correctly reflected in the UI and the audit log.

### Tests for Milestone 3: Advanced Tooling

- **Focus:** Validating the logic of new, complex features and integrations.
- **Unit Tests:**
  - Test the business logic for merging duplicate issues in isolation.
  - Test the state changes and interactions of the "Me Too" button component.
- **Integration Tests:**
  - Test the tRPC procedures for merging issues and upvoting, ensuring they correctly modify the database and handle edge cases.
  - Test the image upload feature by mocking the Cloudinary API. The test will verify that the frontend correctly prepares the file and that the backend attempts to upload it to the external service.
- **End-to-End Tests:**
  - **Merge Flow:** Automate a `Member` logging in, finding two similar issues, executing a merge, and verifying that the UI correctly reflects the new canonical issue and its updated audit log.
  - **Image Upload Flow:** Extend the public submission E2E test to include uploading an image and verifying it appears on the issue page.

### Tests for Milestone 4: Full Notification System

- **Focus:** Ensuring reliable, event-driven communication and final system stability.
- **Unit Tests:**
  - Test the notification-triggering logic to ensure that the correct conditions (e.g., issue status change to "Resolved") trigger the correct notification type for the correct users.
- **Integration Tests:**
  - Test the integration with the transactional email service. These tests will **not** send real emails. Instead, they will mock the email service's API and assert that when an action occurs (like closing an issue), the application makes the correct API call to the service with the appropriate recipient, subject, and content.
- **End-to-End Tests:**
  - **Notification Flow:** Automate the full anonymous user flow: submit an issue with an email, have an admin resolve it, and then check a mock email inbox (using a tool like MailHog or a similar testing utility) to verify the closure email was "sent."
  - **Full Regression Suite:** Before the v1.0 release, execute the entire suite of E2E tests to ensure that no feature has inadvertently broken existing functionality. This serves as the final quality gate.

## Testing Best Practices

### Mocking Patterns

```typescript
// Use typed mocks for better type safety
const mockPrisma = {
  issue: {
    findMany: vi.fn<typeof prisma.issue.findMany>(),
    create: vi.fn<typeof prisma.issue.create>(),
  },
};

// Mock ES modules
vi.mock("~/server/db", () => ({
  prisma: mockPrisma,
}));
```

### ESM Considerations

- Import test utilities using ES module syntax
- Add `.js` extensions if needed for local imports
- Update Vitest configuration for problematic packages
- Use dynamic imports for ESM-only packages in tests

### Organization Isolation Testing

```typescript
// Always test multi-tenancy isolation
it("should not access data from other organizations", async () => {
  const orgA = "org-a-id";
  const orgB = "org-b-id";

  // Create test data for both organizations
  // Attempt to access orgB data with orgA context
  // Assert access is denied
});
```
