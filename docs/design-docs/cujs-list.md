# **PinPoint \- Critical User Journeys (CUJs)**

This document outlines the key user journeys for the PinPoint application, categorized by user role and release phase.

## **Beta Journeys**

### **1\. Anonymous / Public User Journeys**

- **1.1. First-Time Discovery & Issue Reporting:** A user finds a machine with a QR code, scans it, and reports an issue, attaching a photo if permitted.
- **1.2. Location Browsing:** A user navigates to the main organization URL and browses the available machines.
- **1.3. Filtering and Finding a Machine:** A user on a location page uses the text filter to find a specific machine.
- **1.4. Reporting a Duplicate Issue:** A user, unaware of an existing report, submits a new issue for the same underlying problem.
- **1.5. New User Registration & Login:** A user creates an account or logs in via the "Login / Sign Up" modal.

### **2\. Authenticated Public User ("Member") Journeys**

- **2.1. Reporting an Issue While Logged In:** A member reports an issue, and their identity is automatically attached.
- **2.2. Profile Management:** A member navigates to their profile page to update their name and avatar.

### **3\. Machine Owner Journeys**

- **3.1. Viewing Owned Machines:** An owner navigates to their profile page to see a list of their machines.
- **3.2. Managing Notifications:** An owner uses a toggle on their profile page to enable/disable notifications for a specific game.
- **3.3. Reviewing a Machine's Issue History:** From their profile, an owner clicks a machine to view its full issue history.

### **4\. Technician Journeys**

- **4.1. Daily Triage:** A technician filters the main issues list for "New" reports to assess them.
- **4.2. Acknowledging & Closing Issues:** A technician reviews a new report and either "Acknowledges" it as valid or "Closes" it as invalid/duplicate.
- **4.3. Managing Issue Lifecycle:** A technician assigns an issue, changes its status (e.g., to "In Progress"), documents work with comments and photos, and finally "Resolves" it.
- **4.4. Merging Duplicate Issues:** A technician merges a new report into an existing one, preserving the new report's details and photos.

### **5\. Admin Journeys**

- **5.1. Onboarding a New Location:** An admin adds a new physical location to the organization.
- **5.2. Adding a Machine:** An admin adds a new machine, searching OPDB or creating a custom title.
- **5.3. Assigning a Machine Owner:** An admin designates a registered user as the owner of a machine.
- **5.4. Generating a QR Code:** An admin downloads or prints a machine's QR code.
- **5.5. User & Role Management:** An admin promotes a "Member" to a "Technician" or removes a user.
- **5.6. Configuring Photo Upload Permissions:** An admin edits a role to allow or disallow photo uploads for issues.

## **V1.0 & Future Journeys**

### **6\. Advanced Asset & Workflow Journeys**

- **6.1. Setting Location Visibility:** An admin creates a new location (e.g., "The Workshop") and marks it as "Private," hiding it from the public homepage.
- **6.2. Moving a Machine to a Private Location:** A technician moves a broken machine from a public location to the private "Workshop" location to begin repairs off-floor.
- **6.3. Creating an Internal Work Order:** A technician creates a new issue for a machine and checks the "Internal Only" box, making it a private work order for proactive maintenance that is not visible to the public.
- **6.4. Differentiating Issue Types:** On the issue list for a machine, a technician sees clear "Public" and "Private" badges, allowing them to distinguish between customer reports and internal work orders.
- **6.5. Moving a Repaired Machine On-Floor:** An admin moves a repaired machine from "The Workshop" to a public location, making it visible and available to the public again.
- **6.6. Strategic Fleet Analysis:** An admin views a dashboard showing machine counts at all locations (including private ones) to plan game swaps and analyze which machines spend the most time in the workshop.
- **6.7. Proactive Internal Maintenance:** A technician creates a low-priority, internal-only issue to track upcoming scheduled maintenance (e.g., "Flipper Rebuild Due") without alarming the public.
- **6.8. Analyzing a "Problem Child" Machine:** An admin views a machine's detailed history, including its movement log between locations, to determine if it is becoming too costly or unreliable to operate.

### **7\. Advanced Filtering & Organization Journeys**

- **7.1. Structuring a Location with Collections:** An admin edits a location to create several manual collections (e.g., "Front Room," "Back Bar") within the "Rooms" collection group.
- **7.2. Enabling an Auto-Collection:** An admin navigates to the organization settings and enables the "Manufacturer" collection group, making it visible as a filter option on all public location pages.
- **7.3. Filtering by Collection:** A public user on a location page expands the "Manufacturer" drawer and clicks "Bally" to see all machines made by that manufacturer.
