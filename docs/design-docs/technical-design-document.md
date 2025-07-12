## System Architecture

### Architectural Model

The system will be architected as a multi-tenant web application utilizing a shared database with row-level security. This model is chosen for its cost-effectiveness, ease of maintenance, and its native ability to support global user accounts that can belong to multiple, fully isolated Organization workspaces. Data segregation is the highest priority; a mandatory organization_id column will be present on nearly every table, and every database query executed through the ORM will be strictly scoped by the organization_id derived from the request's context (e.g., subdomain), ensuring tenants can only ever access their own data.

### External Data Integration: OPDB and PinballMap

PinPoint integrates with the Open Pinball Database (OPDB) and [PinballMap.com](http://pinballmap.com/) to provide authoritative game data and streamline game management:

- **Hybrid Data Model:** Game Titles are sourced from OPDB but cached locally for performance and offline capability
- **API Integration:** Server-side integration with OPDB's REST API for searching, fetching, and syncing game data
- **Data Synchronization:** Periodic sync processes to keep local game data up-to-date with OPDB
- **Fallback Strategy:** Support for custom game titles when OPDB data is unavailable or incomplete
- **PinballMap Sync:** Game lists can be synced with [PinballMap.com](http://pinballmap.com/) to automate adding and removing game instances.

### Technology Stack

The technology stack outlined in the initial plan remains the ideal choice, offering a modern, type-safe, and highly productive development experience.

| Component             | Recommendation               | Justification                                                                                                                                                                                                    |
| --------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language              | **TypeScript**               | Provides essential static type safety, which is critical for building and maintaining a complex, multi-tenant system. It reduces runtime errors and improves developer confidence.                               |
| Full-Stack Framework  | **Next.js (using React)**    | Its integrated nature (frontend and backend) simplifies development. Middleware is perfect for handling tenant identification from subdomains, and API Routes provide a robust backend framework.1               |
| UI Component Library  | **Material UI (MUI)**        | A mature and comprehensive React component library that will significantly accelerate the development of the various dashboards, forms, and administrative interfaces.1                                          |
| Database              | **PostgreSQL**               | A powerful and robust open-source relational database that is well-suited for the chosen multi-tenant model and complex queries that will be required for analytics.1                                            |
| ORM                   | **Prisma**                   | Its exceptional TypeScript integration ensures that the application's data access layer is fully type-safe, which helps enforce data segregation rules at the query level and prevents common data access bugs.1 |
| Authentication        | **NextAuth.js (Auth.js v5)** | A full-featured authentication solution for Next.js that seamlessly handles social and password-based logins, session management, and the global user model required by the platform.1                           |
| External API Client   | **Fetch API / Axios**        | For integration with OPDB API, handling authentication, rate limiting, and error recovery                                                                                                                        |
| Drag-and-Drop Library | **dnd-kit**                  | A modern, lightweight, performant, and accessible toolkit for building drag-and-drop interfaces. Its flexibility makes it the ideal choice for the Kanban board.14                                               |
| Image Storage         | **Cloudinary**               | A third-party service specializing in asset management. It can easily handle image uploads, transformations, and delivery for multiple tenants, offloading complexity from the application server.1              |
| Deployment            | **Vercel & Vercel Postgres** | Vercel offers first-class support for Next.js and, crucially, for the wildcard subdomains essential for the multi-tenant architecture. This provides a seamless and scalable deployment pipeline.1               |

### Data Model & Database Schema

The database schema is the foundation of the application. The following sections detail the tables required for the v1.0 release and a forward-looking proposal for the v2.0 inventory module. All tables that contain tenant-specific data must include a non-nullable organization_id foreign key.

### Core Application Schema (v1.0)

This schema supports all features for the v1.0 release, including user management, game and issue tracking, and the necessary structures for the Kanban board.

| Table Name                                                                            | Column           | Type                    | Constraints/Notes                                |
| ------------------------------------------------------------------------------------- | ---------------- | ----------------------- | ------------------------------------------------ |
| **User**                                                                              | id               | UUID                    | Primary Key                                      |
|                                                                                       | name             | TEXT                    | Nullable                                         |
|                                                                                       | email            | TEXT                    | Unique, Not Null                                 |
|                                                                                       | emailVerified    | TIMESTAMPTZ             | Nullable                                         |
|                                                                                       | image            | TEXT                    | Nullable                                         |
| **Organization**                                                                      | id               | UUID                    | Primary Key                                      |
|                                                                                       | name             | TEXT                    | Not Null                                         |
|                                                                                       | subdomain        | TEXT                    | Unique, Not Null. Used for routing.              |
| **Membership**                                                                        | id               | UUID                    | Primary Key                                      |
|                                                                                       | role             | ENUM('admin', 'member') | Not Null                                         |
|                                                                                       | user_id          | UUID                    | FK to [User.id](http://user.id/)                 |
|                                                                                       | organization_id  | UUID                    | FK to [Organization.id](http://organization.id/) |
| **IssueStatus**                                                                       | id               | UUID                    | Primary Key                                      |
|                                                                                       | name             | TEXT                    | Not Null                                         |
|                                                                                       | order            | INTEGER                 | For defining column order on Kanban board.       |
|                                                                                       | organization_id  | UUID                    | FK to [Organization.id](http://organization.id/) |
| **Issue**                                                                             | id               | UUID                    | Primary Key                                      |
|                                                                                       | title            | TEXT                    | Not Null                                         |
|                                                                                       | description      | TEXT                    | Nullable                                         |
|                                                                                       | status_id        | UUID                    | FK to [IssueStatus.id](http://issuestatus.id/)   |
|                                                                                       | assignee_id      | UUID                    | FK to [User.id](http://user.id/), Nullable       |
|                                                                                       | reporter_email   | TEXT                    | Nullable, for anonymous reports.                 |
|                                                                                       | game_instance_id | UUID                    | FK to [GameInstance.id](http://gameinstance.id/) |
|                                                                                       | organization_id  | UUID                    | FK to [Organization.id](http://organization.id/) |
| **GameTitle**                                                                         | id               | UUID                    | Primary Key                                      |
|                                                                                       | name             | TEXT                    | Not Null                                         |
|                                                                                       | opdb_id          | TEXT                    | Nullable, OPDB identifier (e.g., "G123-M456")    |
|                                                                                       | manufacturer     | TEXT                    | Nullable, sourced from OPDB                      |
|                                                                                       | release_date     | DATE                    | Nullable, sourced from OPDB                      |
|                                                                                       | image_url        | TEXT                    | Nullable, OPDB image URL                         |
|                                                                                       | description      | TEXT                    | Nullable, game description from OPDB             |
|                                                                                       | is_custom        | BOOLEAN                 | Default false, true for non-OPDB games           |
|                                                                                       | last_synced      | TIMESTAMPTZ             | Nullable, when data was last synced from OPDB    |
|                                                                                       | organization_id  | UUID                    | FK to [Organization.id](http://organization.id/) |
| _(Other tables like Location, GameInstance, Comment, Attachment as per initial plan)_ | ...              | ...                     | ...                                              |

### Inventory Management Schema (v2.0)

This proposed schema is designed for the future inventory module. It is structured to integrate seamlessly with the v1.0 core schema, particularly linking to Organization, Location, Issue, and User. This demonstrates architectural foresight, ensuring the platform is ready for this major expansion.8

| Table Name               | Column          | Type                                         | Constraints/Notes                                                            |
| ------------------------ | --------------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| **Part**                 | id              | UUID                                         | Primary Key                                                                  |
|                          | name            | TEXT                                         | Not Null                                                                     |
|                          | sku             | TEXT                                         | Nullable, Unique within Organization                                         |
|                          | description     | TEXT                                         | Nullable                                                                     |
|                          | cost            | DECIMAL                                      | Nullable, default cost of the part.                                          |
|                          | organization_id | UUID                                         | FK to [Organization.id](http://organization.id/)                             |
| **Supplier**             | id              | UUID                                         | Primary Key                                                                  |
|                          | name            | TEXT                                         | Not Null                                                                     |
|                          | contact_info    | JSONB                                        | Nullable                                                                     |
|                          | organization_id | UUID                                         | FK to [Organization.id](http://organization.id/)                             |
| **StockItem**            | id              | UUID                                         | Primary Key                                                                  |
|                          | quantity        | INTEGER                                      | Not Null, Default 0                                                          |
|                          | reorder_point   | INTEGER                                      | Nullable, for low-stock alerts.                                              |
|                          | part_id         | UUID                                         | FK to [Part.id](http://part.id/)                                             |
|                          | location_id     | UUID                                         | FK to [Location.id](http://location.id/)                                     |
| **InventoryTransaction** | id              | UUID                                         | Primary Key                                                                  |
|                          | type            | ENUM('receipt', 'consumption', 'adjustment') | Not Null                                                                     |
|                          | quantity_change | INTEGER                                      | Not Null (e.g., \\+10 for receipt, \\-1 for consumption)                     |
|                          | notes           | TEXT                                         | Nullable                                                                     |
|                          | stock_item_id   | UUID                                         | FK to [StockItem.id](http://stockitem.id/)                                   |
|                          | user_id         | UUID                                         | FK to [User.id](http://user.id/) (who performed the transaction)             |
|                          | issue_id        | UUID                                         | FK to [Issue.id](http://issue.id/), Nullable (links consumption to a repair) |

### API Specification

The backend API will be implemented using **tRPC** on top of Next.js API Routes. This provides end-to-end type safety between the client and server. All tRPC procedures will be protected and scoped by the multi-tenant middleware.

### OPDB and PinballMap Integration API

The system will integrate with the Open Pinball Database (OPDB) and [PinballMap.com](http://pinballmap.com/) APIs to provide authoritative game data:

- **Authentication:** OPDB API requires authentication via API token
- **Search Integration:** Real-time search of OPDB games during Game Instance creation
- **Data Synchronization:** Periodic sync processes to update local game data
- **Caching Strategy:** Local caching of OPDB data for performance and offline capability
- **PinballMap Sync:** Sync game lists with [PinballMap.com](http://pinballmap.com/) to automate adding and removing game instances. The sync is performed by a tRPC mutation that is only available to admin users. The sync process will add and remove `GameInstance` records based on the real-world machine list at a venue.

### Core CRUD Procedures

The system will expose standard tRPC procedures for managing core entities like `GameInstances`, `Issues`, `Comments`, etc. These will be organized into routers (e.g., `game.router`, `issue.router`) and automatically scoped by the `organization_id` present in the request context.

### Kanban Board Procedures

To support the interactive Kanban board, two key procedures are required within an `issue` router:

- **`issue.getBoardData`**: This is a read-only query procedure designed to fetch all data required to render the Kanban board in a single, efficient network request. The payload will be a fully-typed object containing lists of issues pre-grouped by their status, a list of all configurable statuses for the organization, and a list of all members available for assignment.
- **`issue.update`**: This is the workhorse mutation procedure for all drag-and-drop interactions. It will accept a partial, type-safe input object to update the `Issue` resource. This single procedure can handle changes to status, assignee, or any other field.
  - Example Input for Status Change: `{ issueId: "some-uuid", statusId\": "new-status-uuid\" }`
  - Example Input for Assignee Change: `{ issueId: "some-uuid", assigneeId\": "user-uuid\" }`

### Frontend Architecture

### Implementation Guide: Interactive Kanban Board

The Kanban board is a core interactive feature that demands a high-quality user experience. The implementation will be guided by principles of performance, accessibility, and maintainability.

### Technology Selection: dnd-kit

The choice of a drag-and-drop library is a critical architectural decision. While react-beautiful-dnd (rbd) was once the industry standard for Kanban boards, it is now officially deprecated and no longer maintained by Atlassian.16 Continuing with
rbd or its direct community fork, @hello-pangea/dnd, would introduce significant technical risk for a new project.18
The recommended library for this project is dnd-kit. It is a modern, lightweight, and performant toolkit for React that is actively maintained and built with flexibility and accessibility at its core.14 Unlike the highly opinionated
rbd, dnd-kit provides a set of unopinionated primitives (useDraggable, useDroppable) and hooks, giving the development team full control over the drag-and-drop behavior, styling, and interactions. While this requires more initial setup, the investment is justified by the long-term benefits of control and maintainability for a feature as central as the Kanban board.14

### Component Architecture

The Kanban board will be composed of several key React components:

- \\<KanbanBoard\\>: The top-level container component. It will be responsible for fetching all board data via the GET /api/organizations/\\{orgId\\}/board endpoint and initializing the dnd-kit \\<DndContext\\>. This context provider manages the global drag-and-drop state.
- \\<StatusColumn\\>: This component will represent a single vertical column on the board (e.g., "In Progress"). It will use the useDroppable hook from dnd-kit to register itself as a valid drop zone. It will also provide a \\<SortableContext\\> for the issue cards it contains, enabling smooth reordering within the column.21
- \\<IssueCard\\>: This component will represent a single draggable issue. It will use the useDraggable and useSortable hooks to make itself interactive. It will render the at-a-glance issue details as specified in the PRD.

### Optimistic UI Updates for Drag-and-Drop

To achieve a fluid, high-performance feel, all drag-and-drop actions on the Kanban board will be implemented using an optimistic UI pattern. A delay between a user's action and the UI's response can make an application feel sluggish and broken; this pattern eliminates that perceived latency.5
The implementation flow for a drag-and-drop action (e.g., moving a card to a new column) will be as follows:

1. **Initial State:** The \\<KanbanBoard\\> component maintains the board's structure in its local state (e.g., an object mapping status IDs to arrays of issue objects).
2. **User Action:** The onDragEnd event handler, provided by \\<DndContext\\>, is triggered when the user releases the mouse button after dragging a card.
3. **Optimistic UI Update:** Inside the onDragEnd handler, the code will _immediately_ update the component's local state to reflect the card's new position. React's reconciliation process will then re-render the UI instantly, showing the card in its new column. The new useOptimistic hook in React 18 is designed specifically for this purpose and should be leveraged.6
4. **Asynchronous API Call:** Concurrently with the UI update, an asynchronous PATCH request is dispatched to the /api/issues/\\{issueId\\} endpoint, sending the new statusId or assigneeId to the server for persistence.
5. **Success Handling:** If the API call returns a successful response (e.g., HTTP 200 OK), no further action is needed on the client. The UI already reflects the final, correct state.
6. **Failure Handling:** If the API call fails (due to a server error, network issue, or validation failure), the catch block of the promise is executed. This block must perform two actions: - **Revert the UI:** Set the component's local state _back_ to its original configuration before the drag action began. This will cause the card to animate back to its original position, preserving data integrity. - **Notify the User:** Display a non-intrusive error message (e.g., a toast notification) informing the user that the update failed and they should try again.
   This sequence ensures the application feels instantaneous to the user while guaranteeing that the UI never remains in a state that is inconsistent with the backend.

### Future Architectural Considerations

### Inventory Module Design

The future inventory module will be developed as a logically separate feature within the application codebase (e.g., under a dedicated /src/features/inventory directory). Its data models (Prisma schema), API endpoints, and UI components will be self-contained to the greatest extent possible. The only hard dependencies on the core application will be the necessary foreign key relationships to the Organization, Location, and Issue tables. This loose coupling is a key architectural principle that will make the system easier to develop, test, and maintain in distinct phases.

### Scalability & Deployment

The proposed deployment strategy on Vercel is well-suited for the application's lifecycle. The stateless nature of Next.js serverless functions allows the application layer to scale horizontally and automatically in response to traffic. The PostgreSQL database, whether hosted on Vercel Postgres or a dedicated provider like AWS RDS, can be scaled vertically (by increasing resources) or horizontally (with read replicas for analytics) independently of the application, ensuring that the data layer does not become a bottleneck as the platform grows.1
