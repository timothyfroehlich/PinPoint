# **PinPoint Platform: Product Specification**

### **Introduction & System Overview**

This document provides the single source of truth for all functional and non-functional requirements of the PinPoint platform. It is intended to guide the development team by defining the scope, features, and user experience of the application.

#### **Vision**

The vision for PinPoint is to be the premier, modern, web-based issue tracking system for pinball collectives and arcade operators. PinPoint will streamline maintenance, improve machine uptime, and provide a transparent, high-quality experience for both internal teams and the public. The system is architected as a multi-tenant Software-as-a-Service (SaaS) platform from day one, designed to serve numerous organizations securely and efficiently.1

#### **Core Concepts**

To ensure clarity and a shared vocabulary across all project stakeholders, the following core entities are formally defined 1:

* **Organization:** The top-level tenant in the system, representing an entire collective or arcade chain (e.g., "Austin Pinball Collective"). Each Organization manages its own set of users, locations, games, and issues in a securely isolated environment.
* **Location:** A physical venue or facility belonging to an Organization (e.g., "Pinballz \- Lake Creek"). An Organization can have one or more Locations.
* **Game Title:** The generic, manufacturer-defined model of a pinball machine (e.g., "Godzilla (Premium)," "Twilight Zone"). This serves as a template for creating physical instances.
* **Game Instance:** A specific, physical machine at a given Location. This is the entity to which all Issues are tied, allowing for the tracking of multiple physical copies of the same Game Title.
* **Issue:** A reported problem, maintenance task, or observation associated with a specific Game Instance.
* **User:** A globally unique account holder within the PinPoint system. A single User account can be associated with multiple Organizations, holding different roles in each.
* **Member:** A User who has been added to an Organization and assigned a specific role (member or admin), granting them internal access and permissions.

#### **User Roles & Permissions**

The PinPoint system defines a clear hierarchy of user roles within the context of an Organization. These roles dictate access control for all features, including the new functionalities outlined in this document. The following matrix details the permissions for each role.1

| Feature | Public (Anonymous) | Basic (Registered User) | Member | Admin |
| :---- | :---- | :---- | :---- | :---- |
| View Public Issue Dashboard | ✅ | ✅ | ✅ | ✅ |
| View Game Instance Status Page | ✅ | ✅ | ✅ | ✅ |
| Submit New Issue | ✅ | ✅ | ✅ | ✅ |
| Receive Anonymous Notification | ✅ (Email provided at submission) | N/A | N/A | N/A |
| "Me Too" / Upvote an Issue | ❌ | ✅ | ✅ | ✅ |
| Comment on an Issue | ❌ | ❌ | ✅ | ✅ |
| Merge Duplicate Issues | ❌ | ❌ | ✅ | ✅ |
| Update Issue (Status, Details via Form) | ❌ | ❌ | ✅ | ✅ |
| **Update Issue (Status/Assignee via Kanban)** | ❌ | ❌ | ✅ | ✅ |
| Manage Game Instances & Titles | ❌ | ❌ | ❌ | ✅ |
| Manage Locations | ❌ | ❌ | ❌ | ✅ |
| Manage Organization Users & Roles | ❌ | ❌ | ❌ | ✅ |
| Manage Organization Settings | ❌ | ❌ | ❌ | ✅ |
| **Configure Kanban Board Columns** | ❌ | ❌ | ❌ | ✅ |

### **Platform Foundation Requirements (Release 1.0)**

This section consolidates the MVP and Core Features from the initial planning phase into a single, cohesive v1.0 release target. This feature set represents the complete, robust, and user-friendly application ready for its first production deployment.1

#### **User Authentication & Global Accounts**

The system will provide secure user authentication with support for both social providers (Google) and traditional email/password credentials, managed by NextAuth.js. User accounts are global, allowing a single login to access multiple Organization workspaces via a Memberships model that defines their role within each specific Organization.1

#### **Organization & Game Fleet Management**

Administrators will have access to a dedicated dashboard to manage all aspects of their Organization. This includes editing the organization's profile, creating and managing physical Locations, defining Game Titles in a central library, and creating, editing, or archiving the Game Instances that represent the physical machines at each location.1

#### **Core Issue Lifecycle Management**

The platform will support the full lifecycle of an issue, from public reporting to internal resolution.

* **Public Submission:** A simple, mobile-friendly public form allows anyone to report an issue against a specific Game Instance. This form supports details, photo uploads, and an optional email field for a one-time closure notification.1
* **Internal Management:** Members and Admins have access to a private dashboard to view, filter, and manage all issues. They can update an issue's status, severity, and assignee, as well as add internal comments for discussion.1
* **Audit Trail:** Every issue will feature a complete, time-stamped, and immutable audit log that tracks every change, including status updates, assignments, comments, and merges. This provides full transparency and accountability for the repair process.1

#### **Public-Facing Views & Notifications**

To enhance transparency for players, PinPoint will provide a public dashboard listing all currently open issues for an organization. Furthermore, each Game Instance will have a unique, public status page, accessible via a QR code on the physical machine, displaying its current status and full issue history. The system will integrate with a transactional email service to send automated notifications to game owners, issue subscribers, and anonymous reporters upon key events like issue closure.1

#### **Advanced Issue Tools**

To improve efficiency for internal teams, v1.0 will include tools for merging duplicate issue reports into a single canonical issue. To help with prioritization, registered users will be able to "upvote" an issue with a "Me Too" button, indicating that they have also encountered the problem.1

### **Interactive Kanban View (Post-1.0 Feature)**

This feature provides a highly visual and interactive way for Member and Admin users to manage the issue workflow. It is designed to increase productivity by minimizing clicks and providing a clear, at-a-glance overview of all work in progress.

#### **FR-KAN-01: Board Visualization**

The system shall display a Kanban board view, accessible from the internal dashboard. The board's structure is directly tied to the organization's defined workflow.

* Columns on the board will correspond to the Issue Statuses configured by the organization's Admin (e.g., "Open," "Acknowledged," "In Progress," "Blocked," "Resolved").2
* Each open Issue will be represented as a card within the column that matches its current status, providing a clear visual representation of the workflow.3
* Issue cards must display essential information for quick assessment: Issue ID, a concise title, the name of the associated Game Instance, and the current assignee's avatar or name.4

#### **FR-KAN-02: Drag-and-Drop to Update Status**

This functionality is the core interaction of the Kanban board, enabling rapid status updates.

* **User Story:** As a Member, I want to drag an issue card from one status column to another to quickly update its progress without opening a form.
* **Acceptance Criteria:**
  1. Dragging a card from Column A and dropping it into Column B must trigger an API call to update the issue's status to the one associated with Column B.
  2. The user interface must update optimistically, moving the card to the new column instantly upon drop, before the server confirms the change, to ensure a fluid and responsive experience.5
  3. If the server update fails, the card must animate back to its original position, and a non-intrusive error message must be displayed.
  4. The action must be recorded in the issue's immutable audit log (e.g., "User Jane Doe moved this issue from 'Open' to 'In Progress'").

#### **FR-KAN-03: Drag-and-Drop to Update Assignee**

This provides a similarly efficient method for managing team workload.

* **User Story:** As a Member, I want to drag an issue card and drop it onto another member's avatar to assign the task to them.
* **Acceptance Criteria:**
  1. A designated area on the board (e.g., a "Team" panel displaying member avatars) will serve as a drop zone for assignment.
  2. Dragging an issue card and dropping it onto a specific user's avatar must trigger an API call to update the issue's assigneeId to that user's ID.
  3. This interaction must also feature an optimistic UI update and be logged in the issue's history.

#### **FR-KAN-04: Board Configuration & Filtering**

To accommodate different team workflows, the board must be customizable and filterable.

* Admins shall have a settings interface to configure the Kanban board. This includes selecting which Issue Statuses appear as columns and defining their order on the board.7
* All users with access to the board shall be able to apply filters to the view, such as "Show only my assigned issues," "Show issues for Game X," or "Show issues with 'High' severity."

### **Future Vision (Release 2.0+)**

This section outlines major features and modules planned for future releases. Designing the v1.0 architecture with these in mind will ensure the platform can evolve gracefully without requiring major rewrites.

#### **Epic: Parts & Supplies Inventory Tracking**

The most significant planned evolution for PinPoint is the integration of a full inventory management module. This feature will transform the platform from a simple issue tracker into a comprehensive operational management tool for arcades and collectives, enabling precise cost tracking and proactive maintenance.

* **User Problem:** Technicians lack a centralized system to track spare parts and supplies used for repairs. This leads to preventable stockouts, last-minute emergency purchases, and an inability to accurately calculate the true maintenance cost of a given machine.
* **High-Level Goal:** To integrate a lightweight but powerful inventory management module into PinPoint, allowing organizations to track parts, manage stock levels across multiple locations, and associate part consumption with specific repair issues.
* **Key User Stories (Epics):**
  * **Part Catalog Management:** As an Admin, I want to create and manage a catalog of all parts and supplies (e.g., flipper coils, rubbers, light bulbs), including details like a unique name/ID, SKU, supplier information, and cost.8
  * **Stock Level Management:** As a Member, I want to view the current quantity on hand for any part at my Location and receive automated low-stock alerts to prevent stockouts and trigger reordering.11
  * **Inventory Transaction Logging:** As a Member, I want to log when I use a part for a repair (Consumption), when new stock arrives (Receipt), or when a physical count reveals a discrepancy (Adjustment), so that our inventory records are always accurate and auditable.12
  * **Cost & Usage Reporting:** As an Admin, I want to run reports to see which parts are used most frequently and what the total parts cost is for a specific Game Instance over time, so I can make better data-driven decisions about maintenance, game profitability, and future acquisitions.

## **Part 2: PinPoint Technical Design Document (TDD)**

This document provides the technical blueprint for building the PinPoint system, translating the PRD's requirements into a concrete implementation plan.

### **System Architecture**

#### **Architectural Model**

The system will be architected as a **multi-tenant web application** utilizing a **shared database with row-level security**. This model is chosen for its cost-effectiveness, ease of maintenance, and its native ability to support global user accounts that can belong to multiple, fully isolated Organization workspaces. Data segregation is the highest priority; a mandatory organization\_id column will be present on nearly every table, and every database query executed through the ORM will be strictly scoped by the organization\_id derived from the request's context (e.g., subdomain), ensuring tenants can only ever access their own data.1

#### **Technology Stack**

The technology stack outlined in the initial plan remains the ideal choice, offering a modern, type-safe, and highly productive development experience.1

| Component | Recommendation | Justification |
| :---- | :---- | :---- |
| Language | **TypeScript** | Provides essential static type safety, which is critical for building and maintaining a complex, multi-tenant system. It reduces runtime errors and improves developer confidence. |
| Full-Stack Framework | **Next.js (using React)** | Its integrated nature (frontend and backend) simplifies development. Middleware is perfect for handling tenant identification from subdomains, and API Routes provide a robust backend framework.1 |
| UI Component Library | **Material UI (MUI)** | A mature and comprehensive React component library that will significantly accelerate the development of the various dashboards, forms, and administrative interfaces.1 |
| Database | **PostgreSQL** | A powerful and robust open-source relational database that is well-suited for the chosen multi-tenant model and complex queries that will be required for analytics.1 |
| ORM | **Prisma** | Its exceptional TypeScript integration ensures that the application's data access layer is fully type-safe, which helps enforce data segregation rules at the query level and prevents common data access bugs.1 |
| Authentication | **NextAuth.js (Auth.js v5)** | A full-featured authentication solution for Next.js that seamlessly handles social and password-based logins, session management, and the global user model required by the platform.1 |
| Drag-and-Drop Library | **dnd-kit** | A modern, lightweight, performant, and accessible toolkit for building drag-and-drop interfaces. Its flexibility makes it the ideal choice for the Kanban board.14 |
| Image Storage | **Cloudinary** | A third-party service specializing in asset management. It can easily handle image uploads, transformations, and delivery for multiple tenants, offloading complexity from the application server.1 |
| Deployment | **Vercel & Vercel Postgres** | Vercel offers first-class support for Next.js and, crucially, for the wildcard subdomains essential for the multi-tenant architecture. This provides a seamless and scalable deployment pipeline.1 |

### **Data Model & Database Schema**

The database schema is the foundation of the application. The following sections detail the tables required for the v1.0 release and a forward-looking proposal for the v2.0 inventory module. All tables that contain tenant-specific data must include a non-nullable organization\_id foreign key.

#### **Core Application Schema (v1.0)**

This schema supports all features for the v1.0 release, including user management, game and issue tracking, and the necessary structures for the Kanban board.

| Table Name | Column | Type | Constraints/Notes |
| :---- | :---- | :---- | :---- |
| **User** | id | UUID | Primary Key |
|  | name | TEXT | Nullable |
|  | email | TEXT | Unique, Not Null |
|  | emailVerified | TIMESTAMPTZ | Nullable |
|  | image | TEXT | Nullable |
| **Organization** | id | UUID | Primary Key |
|  | name | TEXT | Not Null |
|  | subdomain | TEXT | Unique, Not Null. Used for routing. |
| **Membership** | id | UUID | Primary Key |
|  | role | ENUM('admin', 'member') | Not Null |
|  | user\_id | UUID | FK to User.id |
|  | organization\_id | UUID | FK to Organization.id |
| **IssueStatus** | id | UUID | Primary Key |
|  | name | TEXT | Not Null |
|  | order | INTEGER | For defining column order on Kanban board. |
|  | organization\_id | UUID | FK to Organization.id |
| **Issue** | id | UUID | Primary Key |
|  | title | TEXT | Not Null |
|  | description | TEXT | Nullable |
|  | status\_id | UUID | FK to IssueStatus.id |
|  | assignee\_id | UUID | FK to User.id, Nullable |
|  | reporter\_email | TEXT | Nullable, for anonymous reports. |
|  | game\_instance\_id | UUID | FK to GameInstance.id |
|  | organization\_id | UUID | FK to Organization.id |
| *(Other tables like Location, GameTitle, GameInstance, Comment, Attachment as per initial plan)* | ... | ... | ... |

#### **Inventory Management Schema (v2.0)**

This proposed schema is designed for the future inventory module. It is structured to integrate seamlessly with the v1.0 core schema, particularly linking to Organization, Location, Issue, and User. This demonstrates architectural foresight, ensuring the platform is ready for this major expansion.8

| Table Name | Column | Type | Constraints/Notes |
| :---- | :---- | :---- | :---- |
| **Part** | id | UUID | Primary Key |
|  | name | TEXT | Not Null |
|  | sku | TEXT | Nullable, Unique within Organization |
|  | description | TEXT | Nullable |
|  | cost | DECIMAL | Nullable, default cost of the part. |
|  | organization\_id | UUID | FK to Organization.id |
| **Supplier** | id | UUID | Primary Key |
|  | name | TEXT | Not Null |
|  | contact\_info | JSONB | Nullable |
|  | organization\_id | UUID | FK to Organization.id |
| **StockItem** | id | UUID | Primary Key |
|  | quantity | INTEGER | Not Null, Default 0 |
|  | reorder\_point | INTEGER | Nullable, for low-stock alerts. |
|  | part\_id | UUID | FK to Part.id |
|  | location\_id | UUID | FK to Location.id |
| **InventoryTransaction** | id | UUID | Primary Key |
|  | type | ENUM('receipt', 'consumption', 'adjustment') | Not Null |
|  | quantity\_change | INTEGER | Not Null (e.g., \+10 for receipt, \-1 for consumption) |
|  | notes | TEXT | Nullable |
|  | stock\_item\_id | UUID | FK to StockItem.id |
|  | user\_id | UUID | FK to User.id (who performed the transaction) |
|  | issue\_id | UUID | FK to Issue.id, Nullable (links consumption to a repair) |

### **API Specification**

The backend API will be implemented using Next.js API Routes. All endpoints will be protected and scoped by the multi-tenant middleware.

#### **Core CRUD Endpoints**

The system will expose standard RESTful or tRPC endpoints for managing core entities like GameInstances, Issues, Comments, etc. All of these will be automatically scoped by the organization\_id present in the request context.

#### **Kanban Board API Endpoints**

To support the interactive Kanban board, two key endpoints are required:

* GET /api/organizations/{orgId}/board: This is a read-only endpoint designed to fetch all data required to render the Kanban board in a single, efficient network request. The payload will be structured to facilitate easy rendering on the frontend, containing lists of issues pre-grouped by their status, a list of all configurable statuses for the organization, and a list of all members available for assignment.
* PATCH /api/issues/{issueId}: This is the workhorse endpoint for all drag-and-drop interactions. It will accept a partial update to the Issue resource. This single endpoint can handle changes to status, assignee, or any other field that might become draggable in the future.
  * Example Body for Status Change: { "statusId": "new-status-uuid" }
  * Example Body for Assignee Change: { "assigneeId": "user-uuid" }

### **Frontend Architecture**

#### **Implementation Guide: Interactive Kanban Board**

The Kanban board is a core interactive feature that demands a high-quality user experience. The implementation will be guided by principles of performance, accessibility, and maintainability.

##### **Technology Selection:** dnd-kit

The choice of a drag-and-drop library is a critical architectural decision. While react-beautiful-dnd (rbd) was once the industry standard for Kanban boards, it is now officially deprecated and no longer maintained by Atlassian.16 Continuing with

rbd or its direct community fork, @hello-pangea/dnd, would introduce significant technical risk for a new project.18

The recommended library for this project is dnd-kit. It is a modern, lightweight, and performant toolkit for React that is actively maintained and built with flexibility and accessibility at its core.14 Unlike the highly opinionated

rbd, dnd-kit provides a set of unopinionated primitives (useDraggable, useDroppable) and hooks, giving the development team full control over the drag-and-drop behavior, styling, and interactions. While this requires more initial setup, the investment is justified by the long-term benefits of control and maintainability for a feature as central as the Kanban board.14

##### **Component Architecture**

The Kanban board will be composed of several key React components:

* \<KanbanBoard\>: The top-level container component. It will be responsible for fetching all board data via the GET /api/organizations/{orgId}/board endpoint and initializing the dnd-kit \<DndContext\>. This context provider manages the global drag-and-drop state.
* \<StatusColumn\>: This component will represent a single vertical column on the board (e.g., "In Progress"). It will use the useDroppable hook from dnd-kit to register itself as a valid drop zone. It will also provide a \<SortableContext\> for the issue cards it contains, enabling smooth reordering within the column.21
* \<IssueCard\>: This component will represent a single draggable issue. It will use the useDraggable and useSortable hooks to make itself interactive. It will render the at-a-glance issue details as specified in the PRD.

##### **Optimistic UI Updates for Drag-and-Drop**

To achieve a fluid, high-performance feel, all drag-and-drop actions on the Kanban board will be implemented using an optimistic UI pattern. A delay between a user's action and the UI's response can make an application feel sluggish and broken; this pattern eliminates that perceived latency.5

The implementation flow for a drag-and-drop action (e.g., moving a card to a new column) will be as follows:

1. **Initial State:** The \<KanbanBoard\> component maintains the board's structure in its local state (e.g., an object mapping status IDs to arrays of issue objects).
2. **User Action:** The onDragEnd event handler, provided by \<DndContext\>, is triggered when the user releases the mouse button after dragging a card.
3. **Optimistic UI Update:** Inside the onDragEnd handler, the code will *immediately* update the component's local state to reflect the card's new position. React's reconciliation process will then re-render the UI instantly, showing the card in its new column. The new useOptimistic hook in React 18 is designed specifically for this purpose and should be leveraged.6
4. **Asynchronous API Call:** Concurrently with the UI update, an asynchronous PATCH request is dispatched to the /api/issues/{issueId} endpoint, sending the new statusId or assigneeId to the server for persistence.
5. **Success Handling:** If the API call returns a successful response (e.g., HTTP 200 OK), no further action is needed on the client. The UI already reflects the final, correct state.
6. **Failure Handling:** If the API call fails (due to a server error, network issue, or validation failure), the catch block of the promise is executed. This block must perform two actions:
   * **Revert the UI:** Set the component's local state *back* to its original configuration before the drag action began. This will cause the card to animate back to its original position, preserving data integrity.
   * **Notify the User:** Display a non-intrusive error message (e.g., a toast notification) informing the user that the update failed and they should try again.

This sequence ensures the application feels instantaneous to the user while guaranteeing that the UI never remains in a state that is inconsistent with the backend.

### **Future Architectural Considerations**

#### **Inventory Module Design**

The future inventory module will be developed as a logically separate feature within the application codebase (e.g., under a dedicated /src/features/inventory directory). Its data models (Prisma schema), API endpoints, and UI components will be self-contained to the greatest extent possible. The only hard dependencies on the core application will be the necessary foreign key relationships to the Organization, Location, and Issue tables. This loose coupling is a key architectural principle that will make the system easier to develop, test, and maintain in distinct phases.

#### **Scalability & Deployment**

The proposed deployment strategy on Vercel is well-suited for the application's lifecycle. The stateless nature of Next.js serverless functions allows the application layer to scale horizontally and automatically in response to traffic. The PostgreSQL database, whether hosted on Vercel Postgres or a dedicated provider like AWS RDS, can be scaled vertically (by increasing resources) or horizontally (with read replicas for analytics) independently of the application, ensuring that the data layer does not become a bottleneck as the platform grows.1
