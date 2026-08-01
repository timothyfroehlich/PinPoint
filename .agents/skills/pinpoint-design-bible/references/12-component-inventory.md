# Component Inventory (§12)

Check this list before building something new.

## 12. Component Inventory

Before building something new, check if one of these already exists:

| Component                             | Purpose                                                                                         |
| :------------------------------------ | :---------------------------------------------------------------------------------------------- |
| `AppHeader`                           | Two-tier responsive header. Icon-only nav at `md:`, icon+text at `lg:`. APC logo at `lg:` only. |
| `HelpMenu`                            | Dropdown with Feedback, What's New, Help, About. Badge dot for unread changelog.                |
| `BottomTabBar`                        | Mobile tab bar (`md:hidden`). Dashboard, Machines, Issues, Report, More.                        |
| `IssueBadgeGrid`                      | Status/severity/priority/frequency display                                                      |
| `IssueBadge`                          | Individual status badge with color                                                              |
| `IssueCard`                           | Issue summary card (normal/compact)                                                             |
| `IssueRow`                            | Table row variant of issue display                                                              |
| `SidebarActions`                      | Issue metadata editing (compact/full, rowLayout)                                                |
| `SaveCancelButtons`                   | Form action buttons                                                                             |
| `Card` / `CardHeader` / `CardContent` | shadcn/ui card                                                                                  |
| `Sheet`                               | Bottom drawer (mobile "More" menu)                                                              |
| `NotificationList`                    | Notification bell + dropdown                                                                    |
| `UserMenu`                            | Avatar + dropdown menu (includes Admin link for admin role)                                     |
| `BackToIssuesLink`                    | Breadcrumb back navigation                                                                      |
| `EmptyState`                          | Icon + title + optional body + optional action. `variant="card"` (default) or `variant="bare"`. |
| `Alert` (shadcn)                      | Inline message. `variant="destructive"` for errors. Never hand-roll `<div role="alert">`.       |
| `Skeleton` (shadcn)                   | Loading placeholder. Shape it like the content that will arrive.                                |
