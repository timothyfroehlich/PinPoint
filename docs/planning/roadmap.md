# **PinPoint Release Plan**

This document categorizes the features and capabilities from the PRD outline into a phased release schedule.

## **Beta**

_The goal of the Beta is to prove the core value proposition with a single, trusted organization (e.g., a collective like APC). The application must be stable and the primary issue-tracking loop must be seamless._

### **Core Capabilities**

- **Machine & Issue Lifecycle:**
  - **Fleet Management:** Integration with OPDB for Model data, support for custom/homebrew Machines, the machine-centric history view.
  - **QR Codes & Status Pages:** Generation of QR codes that link to public, read-only status pages for issue reporting.
  - **Issue Tracking:** All core functionality including public submission, all issue fields (Title, Status, Priority, etc.), rich content with image attachments, and the Consistency field.
  - **Workflow:** Categorized statuses (New, In Progress, Resolved), re-opening issues, immutable history, and re-assigning issues between machines.
- **Organization & User Management:**
  - **User Profiles & Identity:** Comprehensive user profiles and all specified authentication methods (Magic Link, Google, Facebook).
- **Asset & Data Organization:**
  - **Location Management:** Ability to create and manage locations.
  - **Collection System:** Manual collections, collection types, and the special UI for "Rooms" must be functional. Includes the onboarding UX for adding the first collection.
  - **Search & Filtering:** A basic list view for issues with the critical "filter by Machine" capability.
- **Communication & Collaboration:**
  - **Owner Notifications:** The critical email notification to a Machine owner when a new issue is reported.
  - **Comment Editing & Deletion:** Users can edit or delete their own comments on an issue.

### **Technical Principles**

- All specified **Data Model** and **Development & Operations** principles must be implemented from the start. This includes using UIDs, having a unified schema, setting up the CI/CD pipeline, security scanning, error monitoring, and client-side image resizing. These are foundational to a healthy codebase.

## **Version 1.0**

_The goal of 1.0 is the first public, multi-tenant release. The platform should feel polished, complete, and ready for any organization to adopt. This release is defined by robust multi-organization support._

### **Core Capabilities**

- **Organization & User Management:**
  - **Multi-Organization Architecture:** Full support for users belonging to and switching between multiple organizations, including org-level branding.
  - **Subdomain Support:** Organizations can operate on their own subdomain.
  - **Flexible RBAC:** The complete configurable roles and permissions system.
- **Asset & Data Organization:**
  - **Scoped Collections:** Org-level and Location-level scoping for Collections.
  - **Advanced Filtering:** Robust filtering by all other metadata (beyond just by machine).
- **Communication & Collaboration:**
  - **Full Notification System:** In-app notifications and comprehensive email alerts for all key events (@mentions, assignments, etc.), with user-configurable settings.
  - **Community Collaboration:** "Me Too" / Upvote feature on issues.
- **Workflow & Resolution:**
  - **Merge Duplicate Issues:** The tool for cleaning up redundant issue reports.
  - **Sub-tasks / Checklists:** Ability to add a simple checklist within an issue's description to track the smaller steps of a complex repair.

## **Version 1.x**

_This phase includes incremental features and quality-of-life improvements that build upon the stable 1.0 platform, making the application more powerful and enjoyable to use._

### **Core Capabilities**

- **Asset & Data Organization:**
  - **Smart Collections:** Automatically generate collections based on machine attributes.
  - **Kanban View:** Add a Kanban board as an alternative view for the issue list.
  - **Drag-and-Drop UI:** A polished drag-and-drop interface for managing collections.
- **Organization & User Management:**
  - **Advanced Org Management:** Self-serve creation of new organizations and user invitation tools.
- **Integrations:**
  - **PinballMap Integration:** The full two-way sync for machine lists and alerts for new comments.
- **Issue Management:**
  - **Custom Fields:** The ability for organizations to add their own structured data fields to issues (e.g., "Part Number Needed", "Date Part Ordered").
  - **Issue Templates:** Building on Custom Fields, allow users to create templates for common jobs (e.g., "Flipper Rebuild") that pre-populate fields and add checklists.
  - **Advanced Issue Tools:** Linking related issues and the "Create Similar Issue" feature.
- **Knowledge Base (Private):** Ability for users within an organization to add structured notes (Tournament Setup, General Maintenance) to a Machine. These notes are private to the organization.

## **Version 2.0**

_A major evolution of the platform, introducing powerful new ways to derive value from the collected data and community._

### **Core Capabilities**

- **Advanced Analytics & Reporting:** The full dashboard for machine performance, cost tracking, and operational efficiency metrics.
- **Community Knowledge Base (Public Sharing):** Introduce the mechanism to share, review, and promote private notes to a global, community-curated knowledge base for each Model.

## **Version 3.0**

_A long-term, transformative vision to expand PinPoint beyond its initial niche._

### **Core Capabilities**

- **General Arcade & Asset Tracking:** Expand the platform to track and manage non-pinball assets like classic arcade cabinets, integrating with other databases like MAME.

#### **Inventory Tracking\***

- **User Problem:** Technicians lack a centralized system to track spare parts and supplies used for repairs. This leads to preventable stockouts, last-minute emergency purchases, and an inability to accurately calculate the true maintenance cost of a given machine.
- **High-Level Goal:** To integrate a lightweight but powerful inventory management module into PinPoint, allowing organizations to track parts, manage stock levels across multiple locations, and associate part consumption with specific repair issues.
- **Key User Stories (Epics):**
  - **Part Catalog Management:** As an Admin, I want to create and manage a catalog of all parts and supplies (e.g., flipper coils, rubbers, light bulbs), including details like a unique name/ID, SKU, supplier information, and cost.8
  - **Stock Level Management:** As a Member, I want to view the current quantity on hand for any part at my Location and receive automated low-stock alerts to prevent stockouts and trigger reordering.11
  - **Inventory Transaction Logging:** As a Member, I want to log when I use a part for a repair (Consumption), when new stock arrives (Receipt), or when a physical count reveals a discrepancy (Adjustment), so that our inventory records are always accurate and auditable.12
  - **Cost & Usage Reporting:** As an Admin, I want to run reports to see which parts are used most frequently and what the total parts cost is for a specific Game Instance over time, so I can make better data-driven decisions about maintenance, game profitability, and future acquisitions.
