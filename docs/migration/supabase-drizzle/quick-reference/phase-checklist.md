# Migration Phase Checklist

Quick reference for migration tasks. See [GitHub Epic #200](https://github.com/timothyfroehlich/PinPoint/issues/200) for full details.

## Phase 1: Supabase Auth (Weeks 1-2)

- [x] Supabase project setup ([#202](https://github.com/timothyfroehlich/PinPoint/issues/202)) ✅ Completed
- [x] Core auth integration ([#203](https://github.com/timothyfroehlich/PinPoint/issues/203)) ✅ Completed
- [x] tRPC context migration ([#204](https://github.com/timothyfroehlich/PinPoint/issues/204)) ✅ Completed
- [x] Frontend auth components ([#205](https://github.com/timothyfroehlich/PinPoint/issues/205)) ✅ Completed
- [x] Testing & validation ([#207](https://github.com/timothyfroehlich/PinPoint/issues/207)) ✅ Completed

## Phase 2: Drizzle ORM (Weeks 3-4)

### Phase 2A: Drizzle Foundation ✅ COMPLETED (2025-08-02)
- [x] Drizzle schema design ([#208](https://github.com/timothyfroehlich/PinPoint/issues/208)) ✅ **Completed**
  - Complete 1:1 Prisma parity achieved
  - Modular 5-file schema organization
  - Essential performance indexes implemented
  - 39 tests validate foundation (27 CRUD + 12 integration)

### Phase 2B-E: Router Migrations (In Progress)
- [ ] Core routers migration ([#209-212](https://github.com/timothyfroehlich/PinPoint/issues/209))
- [ ] Test suite migration ([#213](https://github.com/timothyfroehlich/PinPoint/issues/213))

## Phase 3: RLS Security (Weeks 5-6)

- [ ] RLS policy design ([#214](https://github.com/timothyfroehlich/PinPoint/issues/214))
- [ ] Database optimization ([#215](https://github.com/timothyfroehlich/PinPoint/issues/215))
- [ ] Query simplification ([#216](https://github.com/timothyfroehlich/PinPoint/issues/216))
- [ ] Production deployment ([#217](https://github.com/timothyfroehlich/PinPoint/issues/217))

## Rollback Procedures

**Phase 1:** Revert to NextAuth (environment variables)  
**Phase 2:** Revert to Prisma (keep Supabase auth)  
**Phase 3:** Disable RLS policies (restore manual filtering)
