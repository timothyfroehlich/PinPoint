# **Pinpoint Detailed Feature Specifications (Phased Development Plan)**

Audience: Project Lead / Developer
Purpose: To provide a detailed, comprehensive breakdown of all planned features for PinPoint, organized by development phase.
Created with Gemini. There may be some small inconsistencies or odd jargon. I'll try to do one more re-read to clean up issues soon

### **1\. Core Concepts & Terminology**

- **Organization:** The top-level tenant. This represents an entire collective or an arcade chain (e.g., "Austin Pinball Collective," "Pinballz"). Each organization has its own subdomain.
- **Location:** A physical venue belonging to an Organization (e.g., "Pinballz \- The Original," "Pinballz \- Lake Creek"). An organization can have one or more locations.
- **Game Title:** The generic name of a pinball machine (e.g., "Godzilla (Premium)", "Twilight Zone"). **Game Titles are now sourced from the Open Pinball Database (OPDB) rather than being manually entered.** This ensures consistency, accuracy, and provides rich metadata including images, manufacturer information, and release dates.
- **Game Instance:** A specific, physical machine at a location. This allows for handling multiple copies of the same game (e.g., "Godzilla \#1," "Godzilla \#2"). Issues are tied to a GameInstance.
- **User Roles (per Organization):**
  - basic: A registered user who is not a member or admin of the current organization.
  - member: Can manage issues and add comments for their organization.
  - admin: Can manage locations, game instances, users, and content for their organization.

### **1.1 OPDB and PinballMap Integration**

**PinPoint integrates with the Open Pinball Database (OPDB) and PinballMap.com to provide authoritative game data and streamline game management:**

- **Data Source:** All Game Title information is sourced from OPDB's comprehensive database of pinball machines
- **Rich Metadata:** Game Titles include manufacturer, release date, images, and standardized naming
- **Search Integration:** Admins can search OPDB directly when adding new Game Instances
- **Automatic Updates:** The system can refresh game data from OPDB to stay current
- **Fallback Support:** Custom titles can be created for rare or homebrew machines not in OPDB
- **PinballMap Sync:** Game lists can be synced with PinballMap.com to automate adding and removing game instances.

### **2\. Minimum Viable Product (MVP) Features**

This is the baseline set of features required to launch a functional and useful system, architected for multi-tenancy from day one.

- **Multi-Tenant Backend Architecture:**
  - The database schema and core application logic will be designed to support multiple, fully segregated organizations from the start, even if the MVP UI only supports a single organization.
- **User Authentication & Global Accounts:**
  - Secure user signup and login with both Google and email/password. A user's account is global and can be associated with multiple organizations.
- **Core Game & Issue Views (for a single, hardcoded Organization):**
  - **Admin Game Management:** An interface for admins to define Game Titles (e.g., "Medieval Madness") and then create one or more Game Instances of those titles at their location. Each instance can have a unique identifier (e.g., "\#1", "By the bar").
  - **Instance-Specific Status Pages:** A unique, public URL for each GameInstance, intended to be linked from a QR code.
  - **Main Issue Dashboard:** A public page listing all currently open issues for the organization's location.
- **Basic Issue Submission & Management:**
  - **Public Submission Form:** A form for anyone to submit an issue against a specific GameInstance.
  - **Member/Admin Issue Management:** A private dashboard where members can view and update the status of any issue within their organization.
- **Issue History / Audit Log:**
  - Every issue page will display a chronological log of all actions taken.

### **3\. Core Features ("Version 1.0" Release)**

These features build on the MVP to create a complete, robust, and user-friendly application.

- **Advanced Issue Management Tools:**
  - **Merge Duplicate Issues:** A tool for members to merge multiple reports into one canonical issue.
  - **"Me Too" Button:** A button for users to upvote an issue.
- **Full Notification System:**
  - **Integration:** Connection to a transactional email service.
  - **Owner/User Subscriptions:** Granular notification controls for game owners and any interested members.
  - **Anonymous Notifications:** A single closure notification for anonymous reporters.
- **Image Uploads:**
  - **Functionality:** Allow users to upload up to 3 images with an issue or comment.
  - **Client-Side Resizing & Camera Access:** User-friendly image handling on desktop and mobile.
  - **Server-Side Constraints:** Validation for file size and type.
- **User & Admin Dashboards:**
  - **User Profile & Settings Page:** A global settings page for users to manage their profile, passwords, and all subscriptions across all their organizations.
  - **Admin Content Management:** A dashboard for organization admins to manage their Quick Report templates, Severity Levels, and Issue Status options.

### **4\. Post-1.0 Enhancements**

These features unlock the full multi-tenant potential and add significant value.

- **Full Multi-Tenancy Platform:**
  - **Super Admin Dashboard:** A system-level interface for the platform owner to onboard new Organizations.
  - **Public Onboarding / Signup:** A public-facing page where a new collective or arcade can sign up, create their organization, and set up their first location and admin account.
  - **Migration to Root Domain:** As part of the platform launch, migrate from the initial subdomain to a dedicated root domain (e.g., pinpoint.com) to support dynamic subdomains for each organization.
- **Multi-Location Management:**
  - **Admin UI:** An interface for admins to create and manage multiple Locations within their Organization.
  - **Relocation UI:** A tool for admins to easily relocate a GameInstance from one Location to another.
  - **Dashboard Filtering:** A filter on the main issue dashboard to view issues for a specific location or all locations.
- **Community & Search:**
  - **Discord/Slack Webhook:** Per-organization integration.
  - **Fuzzy Search:** For instantly finding GameInstances on the submission form.
  - **Advanced Search & Filtering:** Full-text search and advanced filters for members.
- **Analytics Dashboard:**
  - Per-organization analytics on issue trends and machine performance, with options to filter by location.
