# PinPoint: Modern Issue Tracking for Arcades & Collectives

[![CI](https://github.com/froeht/PinPoint/actions/workflows/ci.yml/badge.svg)](https://github.com/froeht/PinPoint/actions/workflows/ci.yml)

PinPoint is a full-stack, multi-tenant issue tracking system designed from the ground up to streamline pinball machine and arcade game maintenance. It provides a transparent, high-quality experience for both players and the internal teams responsible for keeping the games running perfectly.

## About The Project

For many pinball collectives and arcade operators, tracking machine issues is a chaotic process involving text messages, Discord threads, and forgotten sticky notes. This disorganization leads to lost reports, delayed repairs, and frustrated players.

PinPoint solves this by providing a centralized, modern platform for the entire issue lifecycle. It empowers players to easily report problems while giving operators and technicians the tools they need to manage repairs efficiently, track machine history, and ultimately improve uptime. [1]

The system is architected as a multi-tenant SaaS platform, allowing multiple organizations to manage their game fleets in a secure and isolated environment. [1]

### Key Features

**For Players & Guests:**

- **Public Issue Dashboard:** See a list of all known issues at a location to avoid duplicate reports. [1]
- **Game Status Pages:** Scan a QR code on any machine to view its current status and complete maintenance history. [1]
- **Simple Issue Reporting:** Use a mobile-friendly form to quickly report problems, complete with photo uploads. [1]
- **Optional Notifications:** Provide an email to receive a one-time notification when the issue you reported is resolved. [1]

**For Operators & Technicians:**

- **Secure, Role-Based Access:** Manage your organization with distinct permissions for `Admins` and `Members`. [1]
- **Fleet Management:** Define game titles and manage every physical `Game Instance` across one or more `Locations`. [1]
- **Internal Management Dashboard:** A private dashboard to view, filter, and manage all issues. Update status, severity, and assignees, and hold internal discussions with comments. [1]
- **Complete Audit Trail:** Every issue features a time-stamped, immutable log of every action taken, providing full accountability. [1]
- **Advanced Tools:** Merge duplicate issues into a single canonical report and allow registered users to "upvote" issues to help with prioritization. [1]

### Built With

This project leverages a modern, type-safe, and performant technology stack to ensure a great developer and user experience. [1]

- **Framework:** [Next.js](https://nextjs.org/)
- **Language:**([https://www.typescriptlang.org/](https://www.typescriptlang.org/))
- **UI Library:**([https://react.dev/](https://react.dev/))
- **Styling:**([https://tailwindcss.com/](https://tailwindcss.com/)) & [Material UI (MUI)](https://mui.com/)
- **Database ORM:** [Prisma](https://www.prisma.io/)
- **Database:**(<https://www.postgresql.org/>)
- **Authentication:** [NextAuth.js](https://next-auth.js.org/)

## Roadmap

PinPoint is designed to evolve. Key features planned for future releases include:

- **Interactive Kanban Board:** A visual, drag-and-drop interface for members to manage the issue workflow, allowing for rapid updates to status and assignees.
- **Parts & Inventory Tracking (v2.0):** A comprehensive module to manage spare parts and supplies. This will allow organizations to track stock levels, associate part consumption with specific repairs, and analyze the true maintenance cost of each game.

This roadmap ensures that PinPoint will grow from a powerful issue tracker into a complete operational management tool for any arcade or collective.
