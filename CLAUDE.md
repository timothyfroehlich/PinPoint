# PinPoint Development Instructions

## 🚨 CRITICAL: Non-Negotiable Patterns 🚨

**ENFORCEMENT REFERENCE:** @docs/NON_NEGOTIABLES.md - Static analysis patterns that MUST be enforced during file reviews

**KEY VIOLATIONS:**

- Memory safety (PGlite per-test instances) → System lockups
- Migration files in pre-beta → Architectural violation
- Vitest redirection → Breaks test execution
- Schema modifications → Breaks locked foundation
- Missing organization scoping → Security vulnerability
- Client Component overuse → Violates server-first architecture
- MUI patterns in new code → Use shadcn/ui for new development

---

## 🚨 MANDATORY: USE CONTEXT7 EXTENSIVELY 🚨

**CRITICAL DIRECTIVE:** Always use Context7 for current library documentation when:

- Working with any library/framework (Drizzle, Supabase, Next.js, shadcn/ui, Server Components, Server Actions, Vitest, etc.)
- Your knowledge might be outdated (training cutoff January 2025, now August 2025)  
- Looking up API changes, new features, or current best practices
- Need examples of modern patterns and implementation approaches

**Process:** `resolve-library-id` → `get-library-docs` → Apply current patterns
**Why:** Libraries evolve rapidly, my training is 7+ months behind critical updates

---

## 🔥 PROJECT EVOLUTION: DUAL EVOLUTION PHASE 🔥

**CONTEXT**: Solo development project in pre-beta phase undergoing two parallel evolutions:

### **Evolution Track 1: RSC Migration** 🔄
**STATUS**: Phase 1A Foundation **IN PROGRESS/NEARLY COMPLETE**

- **Architecture**: Transformation from client-heavy MUI to server-first React Server Components with shadcn/ui
- **Approach**: Complete rewrite rather than incremental migration  
- **Foundation Status**: shadcn/ui + Tailwind setup (Phase 1A)
- **Next Phases**: Data Access Layer → Server Actions → Layout Conversion

### **Evolution Track 2: Test System Reboot** 🧪
**STATUS**: Archive Complete, **READY FOR ARCHETYPE IMPLEMENTATION** 

- **Archive**: ~130 files archived and removed from active codebase
- **Target**: Archetype-based system with 9 test archetypes, auto-generated mocks
- **Foundation**: pgTAP RLS + smoke tests + 1 baseline unit test
- **Next Phase**: Archetype implementation with slash command creation

### **Project Context**:

- Pre-beta phase with no production users
- Solo development, high risk tolerance for breaking changes
- Core features and navigation still being decided

---

## 🎯 RSC MIGRATION STATUS & GUIDANCE

### **Current Migration Phase Status**

**Phase 1A: shadcn/ui + Tailwind Foundation** ✅ **NEARLY COMPLETE**
- shadcn/ui components installed: Button, Card, Input, Avatar, Separator
- Configuration files in place: `components.json`, `tailwind.config.ts`, `postcss.config.js`
- Utility functions: `src/lib/utils.ts` with `cn()` helper
- Migration bridge: `src/components/ui/migration-bridge.tsx` for gradual transition
- CSS integration: `src/app/globals.css` with layer isolation

**Phase 1B: Data Access Layer (DAL)** 📋 **NEXT**
- Server-side database queries for Server Components
- Direct Drizzle queries replacing client tRPC calls
- Organization-scoped query patterns

**Phase 1C: Server Actions Infrastructure** 📋 **PLANNED**
- Form handling and mutations replacing client-side tRPC
- Type-safe form validation and revalidation patterns

**Phase 1D: Layout Conversion** 📋 **PLANNED**
- Server-first navigation with client islands
- Hybrid authentication patterns

### **RSC Architecture Principles**

**Server-First Approach**:
- **Default**: Server Components for all new development
- **Client Islands**: Minimal Client Components for specific interactivity
- **Hybrid Components**: Server shell + Client islands for complex interactions

**Component Strategy**:
```typescript
// ✅ Server Component (default)
export default async function IssuesPage() {
  const issues = await getIssuesForOrg(orgId); // Direct DB query
  return <IssueListServer issues={issues} />;
}

// ✅ Client Island (minimal interactivity)
"use client";
export function SearchInput({ onSearch }: { onSearch: (term: string) => void }) {
  return <Input onChange={...} />; // shadcn/ui component
}

// ✅ Hybrid Component (Server data + Client interactions)
export default async function IssueDetailHybrid({ issueId }: { issueId: string }) {
  const issue = await getIssueById(issueId); // Server data
  return (
    <div>
      <IssueHeader issue={issue} /> {/* Server rendered */}
      <CommentFormClient issueId={issueId} /> {/* Client island */}
    </div>
  );
}
```

**Data Flow Patterns**:
- **Server Components**: Direct database queries via Data Access Layer (DAL)
- **Client Components**: Server Actions for mutations, minimal state
- **Forms**: Server Actions with progressive enhancement

---

## 🎨 STYLING & UI FRAMEWORK GUIDANCE

### **shadcn/ui + Tailwind CSS (Primary System)**

**For ALL new development**: Use shadcn/ui components with Tailwind CSS

```typescript
// ✅ New development patterns
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";

export function IssueCard({ issue, className }: IssueCardProps) {
  return (
    <Card className={cn("border-l-4 border-l-primary", className)}>
      <CardHeader>
        <h3 className="font-semibold text-lg">{issue.title}</h3>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{issue.description}</p>
        <Button variant="outline" size="sm">View Details</Button>
      </CardContent>
    </Card>
  );
}
```

### **MUI Coexistence (Transitional)**

**Current MUI components**: Continue working, no immediate changes required
**New development**: shadcn/ui only, no new MUI components
**Migration strategy**: Component-by-component replacement when convenient

```typescript
// ✅ Coexistence during transition
import { Button as MuiButton } from "@mui/material"; // Existing
import { Button } from "~/components/ui/button"; // New development

export function TransitionExample() {
  return (
    <div className="space-y-4">
      <MuiButton variant="contained">Existing MUI Button</MuiButton>
      <Button>New shadcn/ui Button</Button>
    </div>
  );
}
```

**CSS Layer Isolation**: Tailwind and MUI coexist via CSS layer strategy in `src/app/globals.css`

---

## 🔒 SCHEMA & SEED DATA LOCK-IN (IMMUTABLE FOUNDATION)

**CRITICAL CONSTRAINT**: Schema and seed data are **LOCKED IN** and considered immutable:

### **Schema is KING**

- **Database schema is COMPLETE and LOCKED** - no changes allowed
- **All TypeScript errors must be fixed by conforming CODE to SCHEMA**
- Schema defines the source of truth - code adapts to schema, not vice versa
- Only exceptional circumstances justify schema modifications

### **Seed Data is KING**

- **Seed data structure is COMPLETE and LOCKED** - no changes allowed
- All SEED_TEST_IDS are finalized and hardcoded for predictable testing
- Test infrastructure built around existing seed data patterns
- Code and tests must work with existing seed data structure

### **Development Approach**

- ✅ Fix imports to match actual schema exports (`collectionTypes` not `collection_types`)
- ✅ Add required fields that schema demands (`organizationId` in inserts)
- ✅ Use correct property names from schema (`modelId` not `model`)
- ✅ Conform function signatures to existing schema structure
- ✅ Use Server Actions and DAL patterns that work with locked schema
- ❌ **NO** schema changes to fix TypeScript errors
- ❌ **NO** seed data modifications to make code easier

**Why**: Schema and seed represent the completed data architecture. Code quality comes from proper alignment, not schema workarounds.

---

## 🔥 NO MIGRATION FILES ALLOWED 🔥

**💥 WHY NO MIGRATIONS IN PRE-BETA:**

- **Zero users**: No production data to migrate or preserve
- **Schema in flux**: Core features and data models still being decided

```bash
# ❌ NEVER CREATE MIGRATION FILES
supabase/migrations/                    # Directory should remain empty
npm run db:generate                     # Don't generate migrations
drizzle-kit generate                    # Don't run migration generation
```

---

## 🚧 TEST SYSTEM: ARCHETYPE IMPLEMENTATION READY 🚧

**CURRENT PHASE**: Clean foundation established - **READY FOR SYSTEMATIC ARCHETYPE IMPLEMENTATION**

**ARCHIVE STATUS**: ✅ **Test Archive COMPLETE** (~130 files archived and removed from active codebase)
**REMAINING**: pgTAP RLS tests + smoke tests + 1 baseline unit test (inputValidation.test.ts)
**FOUNDATION**: Simplified vitest config, clean package.json, clean test foundation
**NEXT**: Systematic archetype-based test system implementation
**QUALITY EXPECTATIONS**: **All tests and lints should pass** - Report any failures for immediate fixing

### **Test Archetype System (READY FOR IMPLEMENTATION)**

**9 Test Archetypes** with auto-generated mock system:

1. **Unit Tests** (`*.unit.test.ts`) - Pure functions, no dependencies
2. **Component Tests** (`*.component.test.ts`) - React components with RTL
3. **Service Tests** (`*.service.test.ts`) - Business logic with mocked dependencies  
4. **Repository Tests** (`*.repository.test.ts`) - Direct Drizzle operations with PGlite
5. **Router Tests** (`*.router.test.ts`) - tRPC router testing with mock contexts
6. **API Integration Tests** (`*.api.test.ts`) - Full tRPC stack with real PGlite
7. **E2E Tests** (`*.e2e.test.ts`) - Playwright browser automation
8. **RLS Tests** (`*.rls.test.sql`) - pgTAP Row-Level Security policy tests
9. **Schema Tests** (`*.schema.test.sql`) - pgTAP database constraint tests

### **Auto-Generated Mock System**

**Seed Data → Auto-Generated Mocks → Unit Tests** bridge ensures consistency:

```typescript
// Generated from actual seed data
import { GENERATED_MOCKS } from "~/test/generated/mocks";

// Unit test with consistent mock data  
const mockUser = GENERATED_MOCKS.USERS.ADMIN; // Tim Froehlich
expect(validateUser(mockUser)).toBe(true);

// Integration test with same IDs
const orgId = SEED_TEST_IDS.ORGANIZATIONS.primary; // "test-org-pinpoint"
```

### **Implementation Tools**

- **Slash Command**: `/create-test` with archetype analysis and template selection
- **Templates**: Pre-built test templates for each archetype
- **Worker-scoped DB**: PGlite pattern for integration tests
- **Coverage Ramp**: Weekly targets with archetype balance requirements

---

## Claude Memories

- Don't be a yes-man and don't pander to me
- Don't leave references to old/removed things in documentation
- Your training ended in 2024. It's August 2025 now. Don't hesitate to look up the latest documentation if you suspect you're out of date
- We use husky for precommits and preuploads
- We run shellcheck against our scripts
- Default to Server Components for new development, minimal Client Components
- Use shadcn/ui for all new UI development, coexist with MUI during transition

---

## 🚨🚨🚨 CRITICAL SYSTEM RESTRICTIONS 🚨🚨🚨

### ⛔ ABSOLUTELY FORBIDDEN: npm test with Redirection

**🔥 NEVER EVER USE THESE COMMANDS 🔥**

```bash
npm test 2>&1          # ❌ BREAKS VITEST
npm test > file.txt    # ❌ BREAKS VITEST
npm test >> file.txt   # ❌ BREAKS VITEST
npm run test:* 2>&1    # ❌ BREAKS VITEST
vitest 2>&1            # ❌ BREAKS VITEST
```

**💥 WHY THIS BREAKS EVERYTHING:**

- Vitest interprets `2>&1`, `>`, `>>` as **test name filters**
- Instead of redirecting output, Vitest searches for tests matching "2>&1"
- This causes bizarre test behavior and broken output
- **NO REDIRECTION WORKS** with Vitest CLI commands

### ⛔ RSC Architecture Violations

**🔥 SERVER-FIRST VIOLATIONS 🔥**

```typescript
// ❌ NEVER: Client Component for data display
"use client";
export function IssueList() {
  const { data } = trpc.issues.list.useQuery(); // Wrong pattern
  return <div>{/* render */}</div>;
}

// ✅ CORRECT: Server Component with direct query
export default async function IssueList({ orgId }: { orgId: string }) {
  const issues = await getIssuesForOrg(orgId); // DAL function
  return <div>{/* render */}</div>;
}

// ❌ NEVER: New MUI components
import { Button } from "@mui/material"; // Use shadcn/ui instead

// ✅ CORRECT: shadcn/ui for new development
import { Button } from "~/components/ui/button";
```

### ⛔ Other Command Restrictions

- **NEVER use the `find` command** - it's dangerous due to the `-exec` flag which can execute arbitrary commands
- **NEVER use the `psql` command directly** - use `./scripts/safe-psql.sh` instead for database safety
- **NEVER use `curl` for external URLs** - use `./scripts/safe-curl.sh` instead for localhost-only HTTP requests

### ⛔ PostgreSQL Query Limitations

**🚨 CRITICAL: SET Statements Cannot Use Parameters**

```typescript
// ❌ NEVER: Parameterized SET statements (will fail)
await db.execute(sql`SET session.user_id = ${userId}`); // PostgreSQL error

// ✅ ALWAYS: Use sql.raw() with proper escaping for SET statements
await db.execute(sql.raw(`SET session.user_id = '${escapeString(userId)}'`));
```

**Why**: PostgreSQL SET commands are DDL statements, not DML statements - parameters don't work with DDL.

---

## ✅ Safe Command Alternatives

- **ripgrep (rg)** - for content searching: `rg --files | rg "pattern"`, `rg -l "content" --type js`
- **fd/fdfind** - for file discovery: `fd "*.js"`, `fd --type f --changed-within 1day`
- **git ls-files** - for repo files: `git ls-files | grep "\.js$"`
- **safe-psql** - for database access: `./scripts/safe-psql.sh` (localhost-only with safety guardrails)
- **safe-curl** - for HTTP requests: `./scripts/safe-curl.sh` (localhost-only with safety guardrails)
- **shadcn CLI** - for UI components: `npx shadcn@latest add [component]`
- Prefer rg (ripgrep) to find or grep
- Install missing tools with `brew` (preferred) or `apt`

---

## ⚡ Available Commands (Post-Archive, RSC-Ready)

**TESTING COMMANDS** (simplified post-archive):

```bash
# Basic testing (205 tests passing)
npm test                    # Single unit test suite 
npm run test:watch         # Watch mode for unit tests
npm run test:rls           # pgTAP RLS policy tests
npm run smoke             # Playwright smoke tests

# Test creation (planned)
# /create-test              # Slash command for archetype-based test creation
```

**RSC DEVELOPMENT COMMANDS**:

```bash
# shadcn/ui component installation
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input

# Development server
npm run dev                # Next.js with RSC support

# Build & validation
npm run build              # Production build with Server Components
npm run lint               # ESLint with RSC rules
npm run type-check         # TypeScript validation
```

**OTHER COMMANDS**:

```bash
# Single-file validation (may need verification)
npm run validate-file src/lib/file.ts  
```

---

## 🎯 Seed Data Architecture (FOUNDATION PATTERN)

**CRITICAL**: All tests use hardcoded SEED_TEST_IDS for predictable debugging

```typescript
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Primary patterns
SEED_TEST_IDS.ORGANIZATIONS.primary; // "test-org-pinpoint"
SEED_TEST_IDS.ORGANIZATIONS.competitor; // "test-org-competitor"  
SEED_TEST_IDS.USERS.ADMIN; // "test-user-tim"
SEED_TEST_IDS.MOCK_PATTERNS.MACHINE; // "mock-machine-1"
```

**Why**: Predictable debugging vs random UUIDs

---

## 🧪 Server-First Development Patterns

### **Data Access Layer (DAL) Patterns**

```typescript
// src/lib/dal/issues.ts
export async function getIssuesForOrg(organizationId: string) {
  return await db.query.issues.findMany({
    where: eq(issues.organizationId, organizationId),
    with: {
      machine: {
        columns: { id: true, name: true, model: true }
      }
    },
    orderBy: [desc(issues.createdAt)]
  });
}
```

### **Server Actions Patterns**

```typescript
// src/lib/actions/issue-actions.ts
"use server";

export async function createIssueAction(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect("/auth/sign-in");
  
  const organizationId = user.user_metadata?.organizationId;
  if (!organizationId) throw new Error("No organization selected");
  
  const title = formData.get("title") as string;
  const machineId = formData.get("machineId") as string;
  
  const [newIssue] = await db.insert(issues).values({
    title,
    machineId,
    organizationId,
    createdBy: user.id
  }).returning();
  
  revalidatePath("/issues");
  redirect(`/issues/${newIssue.id}`);
}
```

### **Hybrid Component Patterns**

```typescript
// Server Component with Client Islands
export default async function IssueDetailPage({ params }: { params: { issueId: string } }) {
  const issue = await getIssueById(params.issueId); // Server query
  
  return (
    <div className="space-y-6">
      <IssueHeader issue={issue} /> {/* Server rendered */}
      <IssueStatusClient initialStatus={issue.status} issueId={issue.id} /> {/* Client island */}
      <CommentsList comments={issue.comments} /> {/* Server rendered */}
      <CommentFormClient issueId={issue.id} /> {/* Client island */}
    </div>
  );
}
```

---

## 🚨 MANDATORY: Pattern Discovery Synchronization

**CRITICAL WORKFLOW**: When ANY new pattern or "don't" is discovered during development, update `@docs/developer-guides/general-code-review-procedure.md` with:

- **Forbidden patterns** (memory safety, schema violations, RSC violations, etc.)
- **Enforced patterns** (SEED_TEST_IDS, worker-scoped testing, server-first architecture, shadcn/ui)
- **Quality gates** (new validation commands or expectations)
- **File categorization** (new file types or patterns)

---

## 📚 Quick Reference (Auto-Loaded)

Current development patterns (dual evolution context):
@docs/INDEX.md
@RSC_MIGRATION/ - RSC migration plans and current status
docs/quick-reference/INDEX.md
@docs/quick-reference/api-security-patterns.md
@docs/quick-reference/typescript-strictest-patterns.md

**RSC Migration status:**
`RSC_MIGRATION/` - Complete migration plans and phase documentation
`RSC_MIGRATION/PHASE_1A_SHADCN_TAILWIND_SETUP.md` - Foundation setup (nearly complete)

**Test system status:**
Test infrastructure archived and removed from active codebase (130+ files)
`docs/testing/TEST_SYSTEM_REBOOT_PLAN.md` - Archetype implementation plan
`docs/quick-reference/testing-patterns.md` - Current simplified patterns

**Priority approach:**
- **RSC Migration**: Phase 1A foundation nearly complete, ready for Phase 1B (DAL implementation)
- **Test System**: Archive complete, ready for systematic archetype implementation
- **Development**: Server-first with shadcn/ui for all new development

---

## 🚀 Development Workflow for Dual Evolution

### **New Feature Development**

1. **Server-First Architecture**: Start with Server Components and DAL queries
2. **shadcn/ui Only**: Use shadcn/ui components, no new MUI
3. **Client Islands**: Add Client Components only for specific interactivity needs  
4. **Server Actions**: Use Server Actions for forms and mutations
5. **Test Strategy**: Follow archetype system with auto-generated mocks

### **Existing Code Updates**

1. **Preserve Function**: Don't break existing MUI components during RSC migration
2. **Gradual Enhancement**: Convert to Server Components when touching existing code
3. **Test Migration**: Use new archetype system for any new tests
4. **Coexistence**: MUI and shadcn/ui can coexist during transition period

### **Quality Gates**

- All tests must pass before commits
- Use pre-commit hooks (husky + shellcheck)
- Follow server-first principles for new development
- Maintain organization scoping in all queries
- Use SEED_TEST_IDS for predictable testing

---

- Don't commit or push with --no-verify unless explicitly told to
- I only develop with Claude Code. All documentation should be designed for an efficient LLM who needs to be reminded of context but doesn't need to be convinced to do things.
- I don't care about implementation time estimates or splitting work up into days or sessions. I just want to know the scope of changes, what files need to change and by how much
- **Documentation Philosophy**: I want actionable information, not justifications or selling points. Focus on "what" and "how", not "why" something is beneficial. No marketing language, performance claims, or convincing explanations.