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


