# Development Guide

This guide covers the development workflow, tools, and best practices for contributing to PinPoint.

## Development Workflow

1.  **Create a Feature Branch**: Always work on a new branch for each feature or fix.
    ```bash
    git checkout -b feature/my-new-feature
    ```
2.  **Make Changes**: Implement your changes, following the coding patterns in `docs/PATTERNS.md`.
3.  **Run Tests**: Ensure all tests pass before committing.
    ```bash
    npm run validate
    ```
4.  **Commit Changes**: Use conventional commits (e.g., `feat: add new machine form`).
5.  **Push and PR**: Push your branch and open a Pull Request.

## Testing

We use a combination of unit, integration, and end-to-end tests.

- **Unit Tests**: `npm test`
  - Located in `src/**/*.test.ts`
  - Test pure logic and utility functions.
- **Integration Tests**: `npm test` (included in the same command)
  - Test database interactions and Server Actions.
  - Use `pglite` for fast, isolated database testing.
- **End-to-End (E2E) Tests**: `npm run smoke`
  - Located in `e2e/`
  - Use Playwright to test critical user flows.
  - **Note**: Ensure the dev server is running before running E2E tests, or use `npx playwright test` which handles it.

## Component Creation

We use **shadcn/ui** for our component library.

To add a new component:

```bash
npx shadcn@latest add [component-name]
```

Example: `npx shadcn@latest add button`

This will install the component source code into `src/components/ui`. You can then customize it as needed.

## Database Management

We use **Supabase** (PostgreSQL) and **Drizzle ORM**.

### Local Development

- **Push Schema Changes**:

  ```bash
  npm run db:push
  ```

  This syncs your local Drizzle schema with your Supabase database. Use this for rapid development.

- **View Database**:
  ```bash
  npm run db:studio
  ```
  Opens Drizzle Studio to view and edit data.

### Production Migrations

For production changes, we use migrations to ensure safe database updates.

1.  **Generate Migration**:
    ```bash
    npx drizzle-kit generate
    ```
2.  **Apply Migration**:
    ```bash
    npx drizzle-kit migrate
    ```

## Troubleshooting

### Supabase Connection Issues

- **Error**: `P0001: Connection refused`
- **Fix**: Ensure your IP is allowed in Supabase Project Settings > Database > Network Restrictions. For local dev, ensure you have the correct connection string in `.env.local`.

### Type Errors

- **Error**: `Type 'string | null' is not assignable to type 'string'`
- **Fix**: We use strict TypeScript. Ensure you handle null/undefined cases. Use Zod for runtime validation to narrow types.

### Test Setup

- **Issue**: Tests failing with database errors.
- **Fix**: Ensure you are not sharing database state between tests. Our test setup uses `pglite` with a fresh instance for each test worker to ensure isolation.

## Quality Gates

Before merging a PR, the following checks must pass:

- `npm run typecheck`: No TypeScript errors.
- `npm run lint`: No ESLint errors.
- `npm run format`: Code is formatted with Prettier.
- `npm test`: All unit and integration tests pass.
- `npm run smoke`: Critical E2E flows pass.
