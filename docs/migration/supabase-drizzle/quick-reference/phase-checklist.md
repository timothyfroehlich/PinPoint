# Migration Phase Checklist

Quick reference for migration tasks. See [GitHub Epic #200](https://github.com/timothyfroehlich/PinPoint/issues/200) for full details.

## Phase 1: Supabase Auth (Weeks 1-2)

- [ ] Supabase project setup ([#202](https://github.com/timothyfroehlich/PinPoint/issues/202))
- [ ] Core auth integration ([#203](https://github.com/timothyfroehlich/PinPoint/issues/203))
- [ ] tRPC context migration ([#204](https://github.com/timothyfroehlich/PinPoint/issues/204))
- [ ] Frontend auth components ([#205](https://github.com/timothyfroehlich/PinPoint/issues/205))
- [ ] Testing & validation ([#207](https://github.com/timothyfroehlich/PinPoint/issues/207))

## Phase 2: Drizzle ORM (Weeks 3-4)

- [ ] Drizzle schema design ([#208](https://github.com/timothyfroehlich/PinPoint/issues/208))
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
