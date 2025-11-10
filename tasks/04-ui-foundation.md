# Task 4: UI Foundation & Landing Page

**Status**: ⏳ PENDING
**Branch**: `setup/ui-foundation`
**Dependencies**: Task 3 (Supabase SSR Authentication)

## Objective

Tailwind CSS v4, Material Design 3 colors, shadcn/ui setup, and simple landing page.

## Acceptance Criteria

- [ ] Tailwind classes work in components
- [ ] Material Design 3 colors apply correctly
- [ ] shadcn components render with styles
- [ ] No `tailwind.config.js` file exists
- [ ] Can use shadcn components in pages
- [ ] Landing page displays at localhost:3000
- [ ] Landing page looks clean and centered

## Tasks

### Tailwind CSS v4

- [ ] Install Tailwind CSS v4 (`npm install tailwindcss@next`)
- [ ] Create CSS-based Tailwind config in `src/app/globals.css`
  - Use `@import "tailwindcss"` directive
  - Configure with `@config` directive (no `tailwind.config.js`)
- [ ] Add Material Design 3 color system to globals.css
  - Primary, secondary, tertiary colors
  - Surface, background, error colors
  - Light and dark variants
- [ ] Update Next.js config for Tailwind CSS v4
- [ ] Verify Tailwind works in development

### shadcn/ui Setup

- [ ] Install shadcn/ui CLI dependencies
- [ ] Initialize shadcn/ui (`npx shadcn@latest init`)
  - Configure for Next.js App Router
  - Use TypeScript
  - Use CSS variables for theming
- [ ] Install base components:
  - [ ] `button`
  - [ ] `card`
  - [ ] `form`
  - [ ] `input`
  - [ ] `label`
  - [ ] `select`
  - [ ] `textarea`
  - [ ] `badge`
  - [ ] `table`
  - [ ] `dialog`
  - [ ] `dropdown-menu`
  - [ ] `avatar` (for navigation later)

### Simple Landing Page

- [ ] Create `src/app/page.tsx` (replace default)
  - Clean, simple design
  - "PinPoint" heading
  - Tagline: "Pinball Machine Issue Tracking"
  - Brief description (1-2 sentences)
  - Sign Up / Sign In buttons (link to /auth/signup and /auth/login)
  - Link to /report for public issue reporting
  - Use Material Design 3 colors
  - Center content vertically and horizontally
  - **Static content** - same whether user is logged in or not
- [ ] Verify localhost:3000 shows landing page

## Key Decisions

_To be filled during task execution_

## Problems Encountered

_To be filled during task execution_

## Lessons Learned

_To be filled during task execution_

## Updates for CLAUDE.md

_To be filled after completion - what future agents need to know_
