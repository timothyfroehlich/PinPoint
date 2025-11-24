# PinPoint Development Instructions (Gemini and Antigravity)

ALWAYS START ANY TASK BY READING @AGENTS.md
ALWAYS DETERMINE IF YOU SHOULD READ ANY OF THE FILES IN `/docs` BEFORE BEGINNING A TASK

### Mandatory Context7 Usage

- **When**: Working with any library/framework (Drizzle, Supabase, Next.js, shadcn/ui, Server Components, Server Actions, Vitest)
- **Why**: Training cutoff January 2025, current date November 2025 - 10+ months behind
- **Process**: `resolve-library-id` → `get-library-docs` → Apply current patterns

### Essential Documentation (Auto-Load)

- **@docs/NON_NEGOTIABLES.md** - Static analysis patterns
- **@docs/TYPESCRIPT_STRICTEST_PATTERNS.md** - Type safety patterns
- **@package.json** - Available scripts, dependencies, and project configuration
