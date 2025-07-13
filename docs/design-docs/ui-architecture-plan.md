# **PinPoint UI/UX Architecture Plan (Revised for Beta)**

This document outlines the necessary pages and high-level components for the PinPoint application, based on the Beta and V1.0 roadmap, with revisions to focus on a single-tenant public experience and refined user interaction flows.

## **0\. Global Components**

### **Universal Header / Top Navigation Bar**

- **Purpose:** A persistent header present on all pages.
- **Key Components:**
  - Organization Logo.
  - **Authentication Component:**
    - **Logged Out State:** A single "Login / Sign Up" button. Clicking it opens the Authentication Modal.
    - **Logged In State:** The button is replaced with the user's avatar and name. Clicking this opens a dropdown with links to "/profile" and a "Logout" action.

### **Authentication Modal**

- **Purpose:** A single, unified modal for handling both sign-up and login, triggered from the Universal Header.
- **Key Components:**
  - Magic Link (email) input field.
  - Social sign-in buttons (Google, Facebook).
  - Brief text explaining that entering an email will either log in an existing user or create a new account.

## **1\. Public-Facing Pages (Beta)**

### **/ (Public Organization Homepage)**

- **Purpose:** To serve as the main landing page for the organization. It will list all of the organization's public locations.
- **Routing Logic:**
  - **Multi-Location:** Displays a list or grid of all available locations.
  - **Single-Location (Auto-Redirect):** Automatically redirects to /locations/{locationId}.
- **Key Components (for multi-location view):**
  - Organization Name and Logo.
  - A simple grid or list of links to each location page.

### **/locations/{locationId} (Public Location Page)**

- **Purpose:** A public-facing view of all the machines at a specific location.
- **Key Components:**
  - **Header:** Location Name and Address.
  - **Game Filters:**
    - A free-text search bar to instantly filter the list of games by name.
  - **"Report an Issue" Button:** A prominent call-to-action that opens a modal.
  - **Game Grid:** A responsive grid of cards for each machine, updated by the filters.
  - **View All Issues Link:** A link to /locations/{locationId}/issues.

### **/machines/{machineId} (Public Machine Page)**

- **Purpose:** A public, read-only detail page for a specific machine.
- **Key Components:**
  - Machine Identification, Current Status Indicator, Simplified Issue List.
  - **Primary Action:** A "Report an Issue on this Machine" button linking to /machines/{machineId}/report-issue.
  - **View Full History Link:** A link to /machines/{machineId}/issues.

### **/locations/{locationId}/issues & /machines/{machineId}/issues**

- **Purpose:** To display the main issues list, pre-filtered for a specific location or machine.

### **/machines/{machineId}/report-issue (Dedicated Issue Reporting Page)**

- **Purpose:** A dedicated, shareable page for reporting an issue on a specific machine.

## **2\. Authenticated Pages (Beta Core Application)**

### **/dashboard, /issues, /issues/{issueId}, /machines & /machines/{machineId}**

- These pages and their core functionality remain as previously defined, focused on the issue management lifecycle. The "Add/Edit Machine" form will include fields for "Owner" and an integrated OPDB/custom title search.

## **3\. Settings & Administration (Beta)**

### **/profile**

- **Purpose:** Allow any logged-in user to manage their profile and owned machines.
- **Key Components:**
  - Edit name, profile picture, and general notification preferences.
  - **My Owned Machines:** A dedicated section listing machines owned by the user, with a link to the machine's history page and a toggle for issue notifications.

### **/admin/organization**

- **Purpose:** For Admins to manage top-level organization settings.
- **Key Components:**
  - Edit Organization Name and Logo.
  - Configure the single-location redirect setting.

### **/admin/locations**

- **Purpose:** To manage physical locations.
- **Key Components:**
  - A list of all current locations, with options to "Edit" or "Add New Location".
  - **Location Detail/Management View:**
    - Edit Location Name and Address.

### **/admin/users**

- **Purpose:** For Admins to manage user roles.
- **Key Components:**
  - List of all signed-up users.
  - Ability to change a user's role.

## **4\. V1.0 & Future Pages**

### **Multi-Tenancy / Organization Creation**

- **Purpose:** To allow new organizations to sign up for the service.
- **Key Components:**
  - **Public Marketing Homepage:** A new public-facing homepage will be created to market the product to potential new customers.
  - **Sign-Up Flow:** A dedicated sign-up page where a user can create a new account and a new organization simultaneously.

### **Advanced Asset Management**

- **Purpose:** To support complex operational workflows like managing repair shops and moving machines.
- **Key Components:**
  - **Private Locations:** A new "Visibility" setting (Public/Private) will be added to the /admin/locations page. Private locations will not appear on the public homepage but will be available as destinations for machine moves.
  - **Machine Movement:** A "Move Machine" function will be added to the authenticated /machines/{machineId} page, allowing staff to transfer a machine to any other location, including private ones.
  - **Internal-Only Issues:**
    - When creating an issue, staff will see an "Internal Only" checkbox.
    - On issue lists and detail pages, internal issues will be marked with a "Private" badge (e.g., a lock icon) to distinguish them from public-facing reports.

### **Collection System**

- **Purpose:** To introduce a powerful, multi-layered filtering system on the public location pages.
- **Key Components:**
  - **/locations/{locationId} (V1.0 Enhancement):**
    - **Collection Groups:** A series of expandable/collapsible drawers will be added below the search bar.
      - **Drawer Types:** Each drawer will represent a group (e.g., the manual "Rooms" group, or auto-generated groups like "Manufacturer" and "Era").
      - **Interaction:** Expanding a drawer will reveal the specific collections within it (e.g., "Front Room", "Back Bar" or "Bally", "Williams"). Clicking a collection name will filter the game grid.
  - **/admin/organization (V1.0 Enhancement):**
    - **Collection Group Management:** A new section will be added to manage the visibility of auto-generated collection groups. This will be a list of potential groups (e.g., "Manufacturer", "Era") with a toggle to enable or disable them across all public location pages.
  - **/admin/locations (V1.0 Enhancement):**
    - **Manual Collection Management:** The Location Detail/Management View will be enhanced with a dedicated UI section for managing that location's manual collections within the "Rooms" group. This will allow an admin to add, rename, or delete collections like "Front Room" or "On The Wall".
