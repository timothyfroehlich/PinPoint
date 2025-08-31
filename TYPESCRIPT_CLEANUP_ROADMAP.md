# TypeScript Cleanup Roadmap
*Systematic approach to fixing remaining 40+ compilation errors*

## 🎯 **Overview**
Current Status: ~40-50 TypeScript errors remaining after initial cleanup
Root Cause: Incomplete Prisma → Drizzle migration causing schema-code drift

---

## 📋 **Task Categories by Priority**

### **🔥 CRITICAL - Phase 1: Database Relations (Blocking Everything)**
*Fix broken Drizzle relations that components expect*

#### **Task 1.1: Audit Missing Relations in Issues**
**Files**: `src/components/issues/issue-detail-server.tsx`
**Errors**: 
- `Property 'author' does not exist on type Comment` (lines 92, 101)
- `Property 'model' does not exist on type Machine` (line 159)  
- `Property 'status' does not exist on type Issue` (lines 221, 223, 231, 232)

**Root Cause**: Drizzle queries missing `with: {}` relation fetching
**Action Items**:
- [ ] Check if `comments` table has `author` relation defined in schema
- [ ] Check if `machines` table has `model` relation defined in schema  
- [ ] Check if `issues` table has `status` property/relation defined
- [ ] Add missing `with: { author: true, model: true }` to Drizzle queries
- [ ] Verify database has these foreign keys/columns

**Acceptance Criteria**: 
- All relation properties available in components
- No "Property does not exist" errors for database relations

---

#### **Task 1.2: Fix Component Prop Interface Drift**
**Files**: 
- `src/app/locations/[id]/page.tsx` (line 53)
- `src/app/profile/page.tsx` (line 435)

**Errors**:
- `Property 'user' does not exist on type LocationDetailViewProps`
- `Property 'currentUser' does not exist on type ProfilePictureUploadProps`

**Root Cause**: Server Components passing props that Client Components don't expect
**Action Items**:
- [ ] Find `LocationDetailViewProps` interface definition
- [ ] Add missing `user` prop or remove from Server Component
- [ ] Find `ProfilePictureUploadProps` interface definition  
- [ ] Add missing `currentUser` prop or remove from Server Component

**Acceptance Criteria**: 
- Server Component props match Client Component interfaces
- No prop type mismatch errors

---

### **⚠️ HIGH - Phase 2: Index Signature & Realtime Issues**
*Fix dynamic property access from Supabase realtime*

#### **Task 2.1: Fix Realtime Comments Type Safety**
**Files**: `src/components/issues/realtime-comments-client.tsx`
**Errors**: 
- `Property 'author_id' comes from index signature, must use ['author_id']` (lines 80, 111)
- `Property 'id' comes from index signature, must use ['id']` (line 81)
- `Property 'updated_at' comes from index signature, must use ['updated_at']` (line 137)
- `Not all code paths return a value` (line 59)

**Root Cause**: Supabase realtime subscriptions returning untyped payloads
**Action Items**:
- [ ] Add type guards for realtime comment payloads
- [ ] Convert dynamic property access to bracket notation
- [ ] Add proper return statements for all code paths
- [ ] Consider creating transformation functions for realtime data

**Acceptance Criteria**:
- All realtime data properly typed
- No index signature access errors
- All functions have explicit return statements

---

#### **Task 2.2: Fix Additional Index Signature Issues**
**Files**: Multiple files with similar patterns
**Action Items**:
- [ ] Search codebase for remaining index signature errors
- [ ] Apply bracket notation where needed: `obj['property']` instead of `obj.property`
- [ ] Add proper type assertions where safe
- [ ] Create utility functions for common property access patterns

---

### **🔧 MEDIUM - Phase 3: Null Safety & Optional Properties**
*Fix null/undefined handling issues*

#### **Task 3.1: Fix Null Safety in Relations**
**Files**: `src/components/issues/issue-detail-server.tsx`
**Errors**:
- `'issue.assignedTo.name' is possibly 'null'` (line 184)
- `Type 'string | null | undefined' is not assignable to type 'string | undefined'` (line 206)

**Action Items**:
- [ ] Add null checks: `issue.assignedTo?.name ?? "Unassigned"`
- [ ] Fix exactOptionalPropertyTypes violations with proper type handling
- [ ] Audit all relation property access for null safety

**Acceptance Criteria**:
- No null reference errors
- Proper fallbacks for missing relation data

---

#### **Task 3.2: Fix Notification Service Type Issues**
**Files**: `src/lib/services/notification-generator.ts`
**Errors**:
- Name properties can be null but functions expect strings (lines 108, 116, 124)

**Action Items**:
- [ ] Add null checks for user names: `user.name ?? user.email`
- [ ] Update function signatures to accept null names if needed
- [ ] Add proper fallback handling

---

### **🔍 LOW - Phase 4: Schema Consistency & Minor Fixes**
*Address remaining edge cases*

#### **Task 4.1: Fix exactOptionalPropertyTypes Issues**
**Files**: 
- `src/components/issues/issues-list-server.tsx` (line 276)
- `src/lib/organization-context.ts` (line 173)

**Action Items**:
- [ ] Fix `limit: number | undefined` → proper optional handling
- [ ] Fix membership property assignments in organization context
- [ ] Ensure all optional properties follow strictest TypeScript rules

---

#### **Task 4.2: Fix DAL Shared Type Issues**
**Files**: `src/lib/dal/shared.ts`
**Errors**: Multiple "Property does not exist on type 'never'" errors

**Root Cause**: Type inference failing, resulting in `never` types
**Action Items**:
- [ ] Review DAL shared functions for proper type annotations
- [ ] Add explicit return types to prevent `never` inference
- [ ] Fix union type issues causing type narrowing failures

---

#### **Task 4.3: Fix Miscellaneous Issues**
**Remaining scattered errors**:
- `src/lib/errors/error-configs.ts` - showErrorDetails type issue
- `src/server/api/routers/user.ts` - null assignment issue
- Other minor type mismatches

---

## 🚀 **Execution Strategy**

### **Week 1: Database Relations (Phase 1)**
- Focus entirely on Tasks 1.1 and 1.2
- These are blocking other fixes
- Test each relation fix before moving to next

### **Week 2: Realtime & Type Safety (Phase 2)**  
- Fix realtime subscription typing
- Add proper type guards and null checks
- Test realtime functionality thoroughly

### **Week 3: Polish & Edge Cases (Phases 3-4)**
- Clean up remaining null safety issues
- Fix DAL and schema consistency
- Final validation run

---

## 📊 **Success Metrics**
- **Target**: 0 TypeScript compilation errors
- **Milestone 1**: Database relations working (Phase 1 complete)
- **Milestone 2**: Realtime subscriptions typed (Phase 2 complete)
- **Milestone 3**: Full TypeScript compliance (All phases complete)

---

## 🔧 **Tools & Commands**
```bash
# Quick error count check
npm run typecheck:brief 2>&1 | grep "error TS" | wc -l

# Focus on specific file
npx tsc --noEmit src/components/issues/issue-detail-server.tsx

# Test specific component after fixes
npm test -- issue-detail-server
```

---

## ⚠️ **Critical Dependencies**
1. **Phase 1 must complete first** - other errors depend on proper relations
2. **Database schema accuracy** - ensure Drizzle schema matches actual DB
3. **Component interface consistency** - Server/Client component contracts must align
4. **Realtime type safety** - essential for production stability

---

*This roadmap provides a systematic approach to eliminate all remaining TypeScript errors through focused, dependency-aware task execution.*