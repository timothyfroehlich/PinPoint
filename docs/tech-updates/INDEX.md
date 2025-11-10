# Tech Stack Reference

Current best practices for PinPoint's technology stack.

**Note for Greenfield Development:**
These files contain migration context from previous codebase iterations. When reading:

- Focus on the technical patterns and code examples
- Ignore "Migration Context", "Phase", and "Checklist" sections
- Ignore references to "organization scoping" (PinPoint v2 is single-tenant)
- Use official docs + Context7 for authoritative current patterns

## Core Technologies

### **Modern React & Next.js**

- **[react-19.md](./react-19.md)** - cache() API, React Compiler, Server Actions
- **[nextjs.md](./nextjs.md)** - App Router, Server Components, caching behavior

### **UI & Styling**

- **[shadcn-ui.md](./shadcn-ui.md)** - Component library patterns and best practices
- **[tailwind-css-v4.md](./tailwind-css-v4.md)** - CSS-based configuration, performance

### **Data & Backend**

- **[drizzle-orm.md](./drizzle-orm.md)** - Type-safe queries, relational patterns, testing
- **[supabase.md](./supabase.md)** - Server-first authentication patterns

### **Testing**

- **[vitest.md](./vitest.md)** - Modern ES module mocking, integration testing

## Key Patterns

**Server-First Architecture:**

- Default to Server Components
- Use Server Actions for mutations
- Request-level caching with React 19 `cache()`

**Progressive Enhancement:**

- Forms work without JavaScript
- Selective client components for interactivity

**Type Safety:**

- Strict TypeScript configuration
- End-to-end type safety with Drizzle
