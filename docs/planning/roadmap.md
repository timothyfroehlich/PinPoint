This document outlines the phased development plan for the PinPoint platform, breaking down the path to the "Version 1.0" release into four distinct, sequential milestones. Each milestone represents a significant stage of completion, resulting in a functional and testable version of the application that builds upon the last.

### Milestone 1: Foundational Backend & Core Architecture

- **Status:** ✅ Complete
- **Goal:** To establish the complete technical foundation of the application. This non-UI milestone focuses on creating a robust, secure, and scalable backend architecture ready to support all future features.
- **Key Features & Tasks:**
  - **Project Initialization:** Set up the Next.js project with TypeScript, ESLint, and Prettier for code quality and consistency.
  - **Database Schema:** Define and implement the complete v1.0 PostgreSQL schema using Prisma ORM. This includes tables for `User`, `Organization`, `Membership`, `Location`, `GameTitle` (enhanced with OPDB fields), `GameInstance`, `Issue`, `IssueStatus`, `Comment`, and `Attachment`.
  - **Multi-Tenant Logic:** Implement the core multi-tenant architecture. All database queries via Prisma will be architected to enforce row-level security, ensuring that data is strictly segregated by `organization_id`.
  - **Authentication Service:** Configure NextAuth.js to handle global user accounts. Implement secure signup, login, and session management for both email/password and Google social providers.
- **State at Completion:** A fully configured backend with a defined database schema and working authentication. The system is ready for API endpoint development but has no user-facing interface.

### Milestone 2: Minimum Viable Product (MVP) with OPDB Integration

- **Status:** ✅ Complete
- **Goal:** To deliver the first usable version of PinPoint, focusing on the core functionality for a single, hardcoded organization. This milestone makes the platform functional for both public users and internal team members, with enhanced Game Title management powered by OPDB.
- **Key Features & Tasks:**
  - **OPDB Integration:** Implement integration with the Open Pinball Database (OPDB) to provide authoritative game data instead of manual Game Title entry
  - **Enhanced Game Title Management:** Replace manual Game Title creation with OPDB search and selection, including rich metadata like manufacturer, release date, and images
  - **Admin Game Management:** Build the admin-only UI for searching and selecting `Game Titles` from OPDB and creating `Game Instances` (the physical machines)
  - **Public Views:**
    - Create the public issue submission form, allowing anyone to report a problem against a specific `Game Instance`.
    - Develop the main public dashboard that lists all open issues for the organization.
    - Implement the dynamic, instance-specific status pages, designed to be linked from QR codes on physical machines.
  - **Internal Issue Management:**
    - Build the private dashboard for `Members` and `Admins` to view, filter, and manage issues.
    - Implement form-based functionality for updating an issue's status, assignee, and details.
  - **Audit Trail:** Implement the backend logic and frontend display for the immutable issue history log, tracking all changes and comments.
- **State at Completion:** A functional application that fulfills the core promise of the platform for a single organization. The system can be used for daily operations: admins can manage their game fleet, and the public can report and track issues.

### Milestone 3: Advanced Tooling & User Experience

- **Status:** 🌗 Partially Complete
- **Goal:** To enhance the MVP with advanced features that improve workflow efficiency for the internal team and enrich the experience for all users.
- **Key Features & Tasks:**
  - **Advanced Issue Tools:**
    - Implement the "Me Too" / upvote feature for registered users to help prioritize issues.
    - Build the UI and API logic for `Members` to merge duplicate issue reports into a single canonical issue.
  - **Rich Content:** Integrate with Cloudinary to allow users to upload images when submitting issues or adding comments.
  - **User & Admin Dashboards:**
    - Create the global user profile page where users can manage their account details and notification settings.
    - Develop the admin content management dashboard, allowing `Admins` to customize organization-specific data like `Issue Statuses` and severity levels.
- **State at Completion:** A mature and powerful issue tracking system. Internal teams are equipped with tools to handle complex scenarios efficiently, and the overall user experience is more interactive and customizable.

### Milestone 4: Full Notification System & Release Polish (v1.0)

- **Status:** ❌ Not Started
- **Goal:** To complete the v1.0 feature set by implementing a comprehensive notification system and conducting a final round of polishing and optimization, making the platform ready for its official launch.
- **Key Features & Tasks:**
  - **Email Integration:** Integrate a transactional email service (e.g., Resend, Postmark) into the backend.
  - **Notification Logic:**
    - Implement automated email notifications for game owners and subscribed users upon key issue events (e.g., new comment, status change).
    - Implement the one-time closure notification for anonymous reporters who provide an email address.
  - **Final Polish:** Conduct a full application review, focusing on UI/UX consistency, performance optimization, accessibility improvements, and resolving any remaining bugs.
- **State at Completion:** The complete PinPoint v1.0 platform. All specified features are implemented, tested, and polished. The application is robust, user-friendly, and ready for production deployment.

## Post-1.0 Features & Future Roadmap

This section outlines major features and modules planned for future releases beyond v1.0. These features are designed to enhance the platform's capabilities without disrupting the core functionality.

### PinballMap management

- **Status:** ✅ Complete
- **Goal:** Allow organizations to manage their PinballMap locations directly from the client.

### Custom Game Title Support

- **Status:** 🌗 Partially Complete
- **Goal:** Allow organizations to create custom game titles for machines not found in OPDB, such as homebrew games, prototypes, or rare machines.
- **Key Features:**
  - Custom GameTitle creation with manual metadata entry
  - Flag to distinguish custom vs OPDB-sourced games
  - Ability to later "upgrade" custom games to OPDB games if they become available
  - Support for custom game images and descriptions
  - Validation to prevent conflicts with OPDB data

### Multi-Organization Management

- **Status:** 🌗 Partially Complete
- **Goal:** Transition from single-organization to full multi-tenant functionality with organization switching and management.
- **Key Features:**
  - Organization creation and management UI
  - User ability to switch between organizations
  - Organization-specific branding and customization
  - Cross-organization user management

### Advanced Analytics & Reporting

- **Status:** ❌ Not Started
- **Goal:** Provide insights into machine performance, maintenance costs, and operational efficiency.
- **Key Features:**
  - Issue trend analysis and reporting
  - Machine uptime and reliability metrics
  - Cost tracking and analysis
  - Maintenance scheduling and predictions
