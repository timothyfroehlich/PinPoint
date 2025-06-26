
* **API:** tRPC
* **Language:** TypeScript
* **Full-Stack Framework:** Next.js (with React)
* **UI Component Library:** Material UI (MUI)
* **Database:** PostgreSQL
* **ORM:** Prisma
* **Authentication:** NextAuth.js (Auth.js v5)
* **Drag-and-Drop:** dnd-kit
* **Image Storage:** Cloudinary
* **Deployment:** Vercel
* **Organization:** The top-level tenant (e.g., "Austin Pinball Collective").
* **Location:** A physical venue belonging to an Organization.
* **Game Title:** A generic machine model (e.g., "Godzilla (Premium)").
* **Game Instance:** A specific, physical machine at a Location. Issues are tied to this.
* **Issue:** A reported problem or task for a Game Instance.
* **User:** A global account holder.
* **Member:** A User associated with an Organization with a specific role (`admin` or `member`).

1. **Multi-Tenancy:** The application is a multi-tenant system using a shared database with row-level security. Nearly every database table containing tenant-specific data must have a non-nullable `organization_id` column. All database queries must be strictly scoped by this `organization_id` to ensure data isolation.
2. **Global Users:** User accounts are global. A `Membership` junction table links a `User` to an `Organization` and defines their role.
3. **Optimistic UI:** For highly interactive features like the Kanban board, implement optimistic UI updates to ensure a fluid user experience. The UI should update immediately, with the API call happening in the background. Failed API calls must revert the UI to its previous state and notify the user.
4. **Future-Facing Design:** The architecture must accommodate future features.
   * **Post-1.0:** An interactive Kanban board for issue management.
   * **v2.0:** A comprehensive parts and supplies inventory tracking module. New code should not preclude the clean integration of these future modules.

* **TypeScript First:** Use TypeScript for all new code. Leverage its static typing capabilities to ensure code quality and prevent runtime errors.
* **Code Quality:** Adhere to the project's ESLint and Prettier configurations for consistent code style.
* **API:** Backend logic should be implemented using tRPC, built upon Next.js API Routes.
* **Component Structure:** Follow existing patterns for React component structure and state management.
* **Prisma Schema:** When modifying the database, update the `schema.prisma` file. All tenant-specific tables must include the `organization_id` foreign key.
* **Write Tests First:** For new backend logic and critical UI components, write failing tests before writing the implementation code.
* **Testing Stack:** Use Jest for the test runner, React Testing Library for components, and Playwright for End-to-End (E2E) tests.
* **Coverage:** Ensure new features have adequate test coverage, including:
  * **Unit Tests:** For individual functions and components.
  * **Integration Tests:** For API endpoints and component interactions.
  * **E2E Tests:** For critical user workflows (e.g., submitting an issue, managing a game).
* **Multi-Tenancy Tests:** It is absolutely critical to have integration tests that verify data segregation between different organizations.
* **Temporary Files:** When a temporary file is needed to complete a task (e.g., to pass a complex string as a command-line argument), it should be created inside a `/tmp` directory at the root of the project. This directory should be added to the `.gitignore` file.
