# Task 12: Implement Modern Dark UI Overhaul

**Status**: In Progress
**Priority**: High
**Assignee**: Antigravity

## Goal

Transform the PinPoint UI into a clean, dark-mode interface with a focus on the Login page first. The design should be "Modern Dark SaaS" - professional, clean, and functional.

## References

- **Design Mockup**: `reference_design_mockup.png` (Located in this directory)

## Style Guidelines

### Core Aesthetic

"Modern Dark SaaS" — Professional, clean, and utility-focused. Think Linear, GitHub Dark Mode, or Vercel.

- **Vibe**: Functional, high-contrast but easy on the eyes, flat design with subtle borders.
- **No**: Heavy gradients, drop shadows, skeuomorphism, or "gamified" elements (unless specified).

### Color Palette

- **Backgrounds**:
  - **Page Background**: `#1e1e1e` (Dark Gunmetal) - Not pure black, reduces eye strain.
  - **Card/Surface**: `#2d2d2d` (Lighter Gunmetal) - Used for cards, sidebars, and inputs.
  - **Border**: `#3e3e3e` (Subtle Gray) - Used for dividers and input borders.
- **Typography**:
  - **Primary Text**: `#ffffff` (White) - Headings and primary content.
  - **Secondary Text**: `#a1a1aa` (Muted Gray) - Metadata, labels, and descriptions.
- **Status & Accents**:
  - **Primary Action**: `#3b82f6` (Blue) - Buttons, links, active states.
  - **Success/Resolved**: `#22c55e` (Green)
  - **Warning/In Progress**: `#eab308` (Yellow)
  - **Error/Unplayable**: `#ef4444` (Red)

### Typography

- **Font Family**: Clean Sans-Serif (Inter, Geist, or system sans).
- **Weights**:
  - **Regular (400)**: Body text.
  - **Medium (500)**: Buttons, navigation links.
  - **Semi-Bold (600)**: Section headers, card titles.
- **Size**: 14px base size for density, 16px for readability in long text.

### Components

- **Cards**: Flat background (`#2d2d2d`), rounded corners (`rounded-lg`), 1px border (`border-white/10` or `#3e3e3e`).
- **Inputs**: Dark background (`#2d2d2d`), light border, white text. Focus state: Blue border ring.
- **Buttons**:
  - **Primary**: Solid Blue background, White text.
  - **Secondary**: Transparent/Gray background, White text, Border.

## Detailed Checklist

### Phase 1: Foundation & Login (Priority)

- [x] **Theme Setup**:
  - [x] Define CSS variables for Dark Gunmetal theme in `src/app/globals.css`.
  - [x] Update `tailwind.config.ts` (or equivalent) to use these variables.
  - [x] Ensure font is set to clean sans-serif (Inter/Geist).
- [x] **Login Page**:
  - [x] Implement centered card layout for `src/app/login/page.tsx`.
  - [x] Style inputs and buttons according to dark theme.
  - [x] Ensure full functionality.

### Phase 2: Dashboard & Navigation (WIP / "Half-Broken" OK)

    - [ ] Create `DashboardLayout.tsx` to wrap pages.
    - [ ] Integrate Sidebar.

- [ ] **Dashboard Page**
  - [ ] Convert current dashboard to use the new layout.
  - [ ] Switch to a simple List View (no Kanban).
  - [ ] _Note: Functionality is priority, perfect styling is secondary here._

### Phase 3: Issue Detail (Target Design)

- [x] **Timeline Component**
  - [x] Build vertical timeline for comments/status changes.
- [x] **Right Sidebar**
  - [x] Build details sidebar (Assignee, Machine, etc.).
- [x] **Page Assembly**
  - [x] Assemble `src/app/issues/[id]/page.tsx` with the new components.

### Phase 4: Refinement (Current)

- [x] **Login Page Polish**
  - [x] Increase margins and padding in Login card.
  - [x] Improve general spacing ("let it breathe").

### Phase 5: Issue Details Refinement (Current)

- [x] **Header Refactor**
  - [x] Move Machine Name above Issue Title (smaller font).
  - [x] Move Status and Severity chips to a new line below the title.
- [x] **Timeline Visuals**
  - [x] Implement vertical line/circle connector style.
  - [x] Update timestamps to "x minutes/hours/days ago" with tooltip for exact date.
  - [x] Format system messages to be one line, including actor.
- [x] **Sidebar Refactor**
  - [x] Improve Assignee picker UI.
  - [x] Ensure all metadata (Reporter, Created, etc.) is in the sidebar.

### Phase 6: Visual Polish (Current)

- [ ] **Sidebar Layout**
  - [ ] Switch to Row Layout (Label left, Value right) for cleaner look.
  - [ ] Apply to Status, Severity, Assignee, Reporter, Created.
- [ ] **Header Cleanup**
  - [ ] Remove redundant "Status:" and "Severity:" text labels.
  - [ ] Enhance Machine Name typography (breadcrumb style).
- [ ] **Timeline Polish**
  - [ ] Align system message dots perfectly with avatar center.
  - [ ] Style "Add Comment" box (border/background) to frame it better.

## Notes

- **"Half-Broken" Strategy**: We are prioritizing the Login page to be 100% done. The Dashboard and other pages can be in a transitional state during this task.
- **No Kanban**: We explicitly decided against the Kanban board in favor of a list view.
