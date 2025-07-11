Audience: Austin Pinball Collective Members & Stakeholders
Purpose: To provide a high-level overview of the proposed issue-tracking system for review and approval.
Created with Gemini. There may be some small inconsistencies or odd jargon. I'll try to do one more re-read to clean up issues soon.

### **Introduction: Why We Need a Better System**

To keep our growing collection of games in top condition, we need a better way to handle maintenance reports. Our current process can lead to lost reports and delays. This proposal outlines a plan to build **PinPoint**, a modern, web-based issue tracking system designed for our specific needs. The goal is to make reporting easy, streamline repairs, improve machine uptime, and provide a better experience for all players.

### **High-Level Features**

PinPoint is designed with two main user groups in mind: the public and our internal team.

### **For the Public (Players & Guests)**

- **View Open Issues:** A public page lists currently known problems, preventing duplicate reports.
- **Game-Specific Status Pages:** Each physical machine gets a dedicated public page—accessible via QR code—showing its status and full issue history.
- **Report a New Issue:** A simple, mobile-friendly form with quick-report buttons ("Stuck Ball," "Weak Flipper"), a details field, and an option to upload photos.
- **Get Notified (Optional):** Anonymous reporters can provide an email to be notified only when their issue is closed.

### **For the Internal Team (Members, Admins & Owners)**

- **Secure Login:** A single user account can be part of multiple collectives or arcade chains that use PinPoint.
- **Multi-Location Architecture:** The system is architected to support organizations with multiple physical locations, with features to manage an entire inventory across different venues planned for a future update.
- **Update Issue Status:** Maintainers can track an issue's status through its entire repair cycle.
- **Team Discussion & History:** Members can add comments to discuss repairs. All actions are logged in a clear, time-stamped history.
- **Owner Notifications:** Game owners are automatically notified of new issues on their machines and can set their notification preferences.
- **OPDB and PinballMap Integration:** Game titles are sourced from the Open Pinball Database (OPDB) for accuracy, and game lists can be synced with [PinballMap.com](http://pinballmap.com/).

### **Basic Architecture Plan**

PinPoint will be a modern, multi-tenant web application built with industry-standard technologies (**TypeScript** and **Next.js**) for speed, scalability, and reliability.

- **Hosting:** For our initial launch, the system will be deployed on its own subdomain, [**pinpoint.austinpinballcollective.com**](http://pinpoint.austinpinballcollective.com/). This separation ensures stability and allows for independent management. The architecture is designed to allow for a seamless migration to a dedicated domain (e.g., [pinpoint.com](http://pinpoint.com/)) in the future.
- **Database:** All data will be stored securely in a single, shared **PostgreSQL database**, with strict data segregation between organizations enforced at the application level.

### **Estimated Costs**

The chosen technology stack is highly cost-effective. The application can be run for little to no cost on the free "Hobby" plans offered by the recommended services, which are sufficient for our needs. An upgrade to a paid plan would only be necessary if multiple team members require administrative access to the hosting platform itself. A detailed cost breakdown is available in the Technical Design Document.

### **Future Expansion**

This system is being designed with the future in mind. The architecture will be modular, allowing for new features to be added later without disrupting the core application.

- **Membership Management:** A potential future milestone is to build a completely separate, optional module to handle membership and dues tracking within an organization.
- **Platform for Other Collectives:** The system is being architected so that it can be made available to other collectives or arcades in the future, allowing them to use PinPoint for their own locations.

### [**Click here for an interactive mockup of the initial features**](https://g.co/gemini/share/4e4cbb38fa56)
