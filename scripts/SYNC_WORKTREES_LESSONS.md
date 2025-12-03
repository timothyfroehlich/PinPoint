# Sync Worktrees - Lessons Learned

## Date: 2025-12-03

### Issues Encountered

1. **Port Conflicts from Multiple Supabase Instances**
   - **Problem**: When switching branches or merging, multiple Supabase instances (different project_ids) can run simultaneously and conflict on ports
   - **Root Cause**: Supabase instances persist by project_id, not by worktree location
   - **Solution**: Always run `supabase stop --all` before syncing worktrees
   - **Script Update**: Add pre-flight check to stop all Supabase instances

2. **Legacy Docker Volumes (pinpoint-v2)**
   - **Problem**: Old Docker volumes with legacy naming (pinpoint-v2) persist and cause conflicts even after config changes
   - **Root Cause**: Greenfield rewrite used "-v2" suffix that wasn't fully cleaned up
   - **Solution**: Explicitly remove legacy volumes: `docker volume rm supabase_config_pinpoint-v2 supabase_db_pinpoint-v2`
   - **Script Update**: Add cleanup step for legacy volumes

3. **Out-of-Date Main Branch**
   - **Problem**: Main worktree can be behind origin/main, causing false conflicts
   - **Root Cause**: Not pulling latest main before attempting merges
   - **Solution**: Always `git pull origin main` in main worktree first
   - **Script Update**: Add step to update main worktree from origin before processing secondaries

4. **Config.toml Merge Conflicts**
   - **Problem**: `supabase/config.toml` has merge conflicts because it's marked skip-worktree in secondary worktrees
   - **Root Cause**: Secondary worktrees modify config.toml locally (ports/project_id) but skip-worktree prevents git from seeing changes
   - **Current Behavior**: Script auto-resolves by accepting "ours" version
   - **Lesson**: Need to validate that auto-resolution is safe (no structural changes lost)
   - **Script Update**: Check if merge brings structural changes (new keys/sections) vs just port changes

5. **Merge Conflicts Need Manual Review**
   - **Problem**: Auto-resolving all conflicts can lose important changes
   - **Solution**: For non-config.toml conflicts, exit with clear instructions for manual resolution
   - **Script Update**: Only auto-resolve config.toml conflicts, exit for all others

6. **E2E Test Failures After Merge**
   - **Problem**: After merging big features (notifications/ownership), E2E tests fail with "element not found" errors
   - **Root Cause**: Form submissions not redirecting properly - likely due to incompatible changes between branches
   - **Lesson**: Database schema was applied correctly, but application code may have conflicts
   - **Resolution**: Need to investigate pr-567 branch changes vs main changes
   - **Note**: This is a code compatibility issue, not a sync script issue

7. **Test Schema Must Be Auto-Generated**
   - **Problem**: Test schema (`src/test/setup/schema.sql`) can get out of sync with Drizzle schema after merges
   - **Root Cause**: Schema changes from merges don't automatically update test schema
   - **Solution**: Always run `npm run test:generate-schema` after schema changes
   - **Script Update**: Add post-merge step to regenerate test schema
   - **Rationale**: Ensures PGlite test instances use exact same schema as production

8. **`db:reset` Doesn't Restart All Services**
   - **Problem**: After `supabase db reset`, auth and other services remain stopped
   - **Root Cause**: `db:reset` only restarts database container, not full Supabase stack
   - **Solution**: Run `supabase stop && supabase start` instead of just `db:reset`
   - **Impact**: `db:seed-users` fails with ECONNREFUSED on port 54321 (auth service)
   - **Script Update**: Replace `db:reset:local` with full restart in `db:prepare:test`

### Best Practices

1. **Pre-Sync Checklist**:
   - Stop all Supabase instances (`supabase stop --all`)
   - Clean up legacy Docker volumes
   - Pull latest main in main worktree
   - Verify no uncommitted changes in main

2. **During Sync**:
   - Process main worktree first
   - Auto-resolve config.toml conflicts only
   - Exit for manual review on other conflicts
   - Restart Supabase after config changes

3. **Post-Sync Validation**:
   - Regenerate test schema (`npm run test:generate-schema`)
   - Run database prepare script (`npm run db:prepare:test`)
   - Run preflight checks on critical worktrees
   - Verify E2E tests pass on main before syncing secondaries

### Script Improvements Needed

1. Add `supabase stop --all` as first step
2. Add legacy volume cleanup check
3. Add main branch update step (git pull origin main)
4. Improve conflict detection - distinguish config.toml from other files
5. Add post-merge validation option (run preflight)
6. Add better error messages for manual conflict resolution
7. Auto-regenerate test schema after merges (`npm run test:generate-schema`)

### Commands Reference

```bash
# Stop all Supabase instances
supabase stop --all

# Check for legacy volumes
docker volume ls --filter label=com.supabase.cli.project=pinpoint-v2

# Remove legacy volumes
docker volume rm supabase_config_pinpoint-v2 supabase_db_pinpoint-v2

# Update main worktree
cd ~/Code/PinPoint && git pull origin main

# Check git status
git status

# Check skip-worktree status
git ls-files -v supabase/config.toml

# Manual conflict resolution
git checkout --ours supabase/config.toml  # Keep worktree-specific config
git checkout --theirs src/app/**/*.ts     # Accept main changes for code

# Regenerate test schema after schema changes
npm run test:generate-schema
```
