# 26. Action Buttons and Overflow Menus

One standard for every action button and every ⋯ menu in the app: page headers, detail-page headers, and menus on a single item (a comment, a card, a settings set). Feature specs say which actions a page offers and in what order; this section says how they look and where they go.

## 26.1 Where an action goes

- **Its own button:** the page's create action (Add Machine, Add tag, New collection, Invite User) and Share. A page has at most one create action as its own button; a second one (Tags' Add tag type) goes in ⋯.
- **Inside ⋯:** editing (Edit…, Rename…, Move…, Merge…), then Export and Print, then a divider and Delete, in red.
- **Exceptions, named by their page's spec:** a control beside the thing it edits stays visible (an issue's Edit title and Move, issue-detail §4.3, §4.5); Machines' Pinball Map (machine-views §6.6); Tags' Settings tags link; Watch, which stays in the page body.
- **A ⋯ never holds fewer than two entries unless space forces it.** An action that would sit in ⋯ alone shows as its own button.

## 26.2 How buttons look

- A button with a label is outlined. An icon-only button is borderless, with a hover and pressed background.
- The page's create action is filled, labeled or icon-only. It is the only filled button on the page.
- Page action buttons are 36px tall on desktop and 44px on phones (list-views §7.9); an icon-only one is square. Item ⋯ buttons are 32px on desktop and 44px on phones.
- Every icon-only button has an accessible name and, on desktop, a tooltip with the same text.
- When a header runs out of room, labels drop first, then buttons fold into ⋯ one step at a time in the page's order, the create action last. ⋯ itself never folds. List View pages follow list-views §3.7–§3.10 and §8.11–§8.13.

## 26.3 Menus

- One icon for every overflow: ⋯ (lucide `MoreHorizontal`, three dots across) — page actions, item menus, a tab strip's extra tabs, and the tab bar's More. Never ⋮ or a typed "…".
- The page's menu is named **More**. It reads "More" beside its icon while the page's labels fit. On desktop it opens a dropdown; on phones, a sheet titled "More" with 48px rows.
- An item's menu is named for the item ("Comment actions", "Card actions", "Set actions") and opens a dropdown at every width.
- An entry ends in "…" when it asks for more input (Rename…, Edit collection…). Delete only asks to confirm, so it reads "Delete tag", never "Delete tag…". Delete always confirms.
- Menu entries are text only.
- A busy entry shows a spinner and is disabled until its action finishes.
