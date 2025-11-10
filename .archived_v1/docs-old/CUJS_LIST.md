# **PinPoint - Critical User Journeys (CUJs)**

**Last Updated**: September 1, 2025  
**Last Reviewed**: September 1, 2025

This document outlines the key user journeys for the PinPoint application, categorized by user role and release phase. All terminology aligns with the Database Security Specification.

## **Terminology (Aligned with Database Security Spec)**

- **Anonymous User**: Request with no authenticated identity
- **Guest**: Any user (anonymous OR authenticated) lacking membership in the current organization
- **Member**: Authenticated user with a membership row in the organization
- **Admin**: Member role with broad organization-scoped management authority
- **Machine Owner**: User listed in machine ownership with machine/issue privileges
- **Issue Owner**: Reporter or current assignee (both authenticated users)
- **Superadmin**: Out-of-band privileged operator (emergency/maintenance only)

## **Beta Journeys**

### **1. Anonymous User Journeys**

- **1.1. First-Time Discovery & Issue Reporting:** An anonymous user finds a machine with a QR code, scans it, and reports an issue on a public machine, attaching a photo if the organization permits anonymous attachments.
- **1.2. Public Location Browsing:** An anonymous user navigates to the main organization URL and browses only machines in public locations.
- **1.3. Filtering Public Machines:** An anonymous user on a public location page uses filters to find specific machines, seeing only effectively public machines.
- **1.4. Anonymous Comment Creation:** An anonymous user adds a comment to a public issue when `allow_anonymous_comments = TRUE`, but cannot edit/delete afterward.

### **2. Guest Journeys (Authenticated Non-Members)**

- **2.1. Cross-Organization Issue Reporting:** An authenticated user (logged into Account A) reports an issue on Organization B's public machine, with their identity attached but no organization membership privileges.
- **2.2. Profile Management:** A guest user manages their global profile (name, avatar) but has no organization-specific permissions.
- **2.3. Authenticated Comment Creation:** A guest user creates comments on public issues with edit/delete capabilities (unlike anonymous users).
- **2.4. Registration & Login:** A guest user creates an account or logs in, potentially to later join an organization.

### **3. Member Journeys (Authenticated Organization Members)**

- **3.1. Organization Data Access:** A member accesses all issues, machines, and locations within their organization (subject to RLS policies), regardless of public visibility.
- **3.2. Internal Issue Reporting:** A member reports issues on any machine in their organization, including those in private locations.
- **3.3. Member Profile & Organization Context:** A member manages their profile within the organization context, seeing membership-specific data.
- **3.4. Comment Creation on Internal Issues:** A member creates comments on any issue within their organization, including private/internal issues.

### **4. Machine Owner Journeys**

- **4.1. Viewing Owned Machines:** A machine owner navigates to their profile to see machines they own across organizations.
- **4.2. Managing Notifications:** A machine owner toggles notifications for their specific machines.
- **4.3. Machine Issue History:** A machine owner views the complete issue history for their machines, including internal/private issues.
- **4.4. Owner Machine Management:** A machine owner can soft-delete their own machines (within ownership bounds, subject to organization policies).
- **4.5. Cross-Organization Ownership:** A machine owner manages machines they own in multiple organizations.

### **5. Technician Journeys (Members with Specific Permissions)**

- **5.1. Daily Triage:** A technician with appropriate permissions filters issues for "New" status to assess validity.
- **5.2. Issue Lifecycle Management:** A technician assigns issues, changes status to "In Progress," documents work with comments/photos, and marks "Resolved."
- **5.3. Private Issue Creation:** A technician creates internal work orders by setting issue visibility to private (via inheritance, not checkboxes).
- **5.4. Machine Movement (Intra-Organization):** A technician moves machines between locations within the same organization for repairs.
- **5.5. Intake Location Management:** A technician moves broken machines to private intake locations for off-floor repairs.
- **5.6. Issue Merging:** A technician merges duplicate reports, preserving details and attachments (future capability).
- **5.7. Soft Delete Management:** A technician soft-deletes issues/machines with appropriate permissions, maintaining reversibility.

### **6. Admin Journeys**

#### **6A. Organization & Location Management**

- **6A.1. Organization Visibility Control:** An admin toggles organization `is_public` status, affecting all descendant visibility.
- **6A.2. Location Creation & Management:** An admin creates locations, including permanent private intake locations (`is_intake = TRUE`).
- **6A.3. Location Visibility Configuration:** An admin sets location `is_public` to control visibility inheritance for all machines/issues in that location.
- **6A.4. Public Issue Default Configuration:** An admin sets the organization's `public_issue_default` (public/private) for issues with no explicit visibility.

#### **6B. Machine & Asset Management**

- **6B.1. Machine Addition:** An admin adds machines by searching OPDB or creating custom entries.
- **6B.2. Machine Ownership Assignment:** An admin assigns registered users as machine owners.
- **6B.3. Machine Visibility Management:** An admin sets machine `is_public` to override location-level inheritance.
- **6B.4. QR Code Generation:** An admin downloads/prints machine QR codes for physical placement.
- **6B.5. Machine Transfer (Intra-Org):** An admin moves machines between locations within the organization.

#### **6C. Permission & User Management**

- **6C.1. Granular Permission Assignment:** An admin assigns specific permissions (`issue:attachment_upload`, `comment:moderate`, `attachment:delete`, etc.) to users.
- **6C.2. Role-Based Management:** An admin promotes members to technician roles or removes users from the organization.
- **6C.3. Anonymous Policy Configuration:** An admin toggles `allow_anonymous_comments` for the organization.
- **6C.4. User & Membership Management:** An admin views organization members and manages their memberships.

#### **6D. Analytics & Fleet Management**

- **6D.1. Visibility-Bypassed Analytics:** An admin views complete organization data (all machines/issues/locations) regardless of visibility settings for strategic analysis.
- **6D.2. Fleet Movement History:** An admin reviews machine location history to analyze repair patterns and operational efficiency.
- **6D.3. Private Location Analytics:** An admin analyzes time machines spend in private intake locations, MTBF, and issue churn.
- **6D.4. Problem Machine Analysis:** An admin reviews detailed machine history including movement logs to identify costly or unreliable assets.

## **V1.0 & Future Journeys**

### **7. Superadmin Journeys (Emergency/Maintenance Only)**

- **7.1. Emergency Data Access:** A superadmin bypasses all RLS policies for corrective operations during system emergencies.
- **7.2. Cross-Organization Machine Transfer:** A superadmin facilitates machine transfers between organizations through controlled functions (future capability).
- **7.3. Hard Delete Operations:** A superadmin performs irreversible hard deletes for data retention compliance (not available in normal application flows).
- **7.4. System Maintenance:** A superadmin performs database maintenance, policy updates, and infrastructure operations outside normal request paths.

### **8. Advanced Data Integrity & Security Journeys**

- **8.1. Organization Data Isolation:** All operations automatically enforce organization scoping via `organizationId` to prevent cross-tenant data leakage.
- **8.2. Visibility Inheritance Validation:** System validates that visibility changes propagate correctly through the Organization → Location → Machine → Issue hierarchy.
- **8.3. Soft Delete Recovery:** Admins restore soft-deleted machines/issues by clearing `deleted_at`, maintaining full audit trail.
- **8.4. Containment Hierarchy Enforcement:** System blocks operations that would violate the strict containment hierarchy (e.g., floating issues without machines).

### **9. Advanced Permission & Ownership Journeys**

- **9.1. Granular Permission Inheritance:** Users receive combined permissions from role assignments and ownership relationships.
- **9.2. Cross-Organization User Management:** Users manage multiple organization memberships with different roles and permissions in each.
- **9.3. Ownership-Based Access Control:** Machine/issue owners gain specific privileges independent of their organizational role.
- **9.4. Anonymous Content Limitations:** Anonymous users create immutable content (cannot edit/delete after creation), while authenticated users maintain edit capabilities.

### **10. Advanced Filtering & Organization Journeys**

- **10.1. Structuring Locations with Collections:** An admin creates manual collections (e.g., "Front Room," "Back Bar") within collection groups like "Rooms."
- **10.2. Auto-Collection Management:** An admin enables organization-wide collection groups (e.g., "Manufacturer") making them visible as filter options on public location pages.
- **10.3. Hierarchical Filtering:** A guest user filters machines by manufacturer, location, or collection while respecting visibility inheritance rules.
- **10.4. Member-Only Advanced Filtering:** Organization members access enhanced filtering including private locations and internal issues.

---

## **Cross-Reference with Database Security Spec**

This CUJs document aligns with the Database Security Specification sections:

- **§2 Terminology** - All role definitions
- **§6 Visibility Inheritance** - Public/private visibility journeys
- **§7 Roles & Permission Model** - Permission-based user capabilities
- **§8 Permission Catalog** - Granular permission assignments
- **§9 Entity Rules** - Organization, location, machine, and issue behaviors

**Change Management**: Any modifications to user journeys must be validated against the Database Security Specification to ensure data security and containment requirements are maintained.
